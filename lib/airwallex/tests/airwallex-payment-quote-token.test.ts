import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Decimal } from "@prisma/client/runtime/client";

import {
  AirwallexConfigurationError,
  AirwallexValidationError,
} from "../errors/airwallex.errors";
import {
  AIRWALLEX_PAYMENT_QUOTE_TOKEN_TTL_MS,
  createAirwallexPaymentQuoteToken,
  verifyAirwallexPaymentQuoteToken,
} from "../security/airwallex-payment-quote-token";
import type { AirwallexPaymentQuote } from "../services/airwallex-currency.service";

const SECRET = "quote-token-test-secret-is-at-least-32-characters";
const NOW = new Date("2026-08-22T12:00:00.000Z");

function makeQuote(
  overrides: Partial<AirwallexPaymentQuote> = {},
): AirwallexPaymentQuote {
  return {
    baseCurrency: "USD",
    baseAmount: new Decimal("1250.00"),
    displayCurrency: "USD",
    paymentCurrency: "USD",
    paymentAmount: new Decimal("1250.00"),
    exchangeRate: new Decimal("1"),
    exchangeRateAt: new Date("2026-08-22T11:58:00.000Z"),
    stale: false,
    ...overrides,
  };
}

function createToken(quote = makeQuote()): string {
  vi.stubEnv("AUTH_SECRET", SECRET);
  return createAirwallexPaymentQuoteToken({
    userId: "user_123",
    quote,
    now: NOW,
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Airwallex payment quote tokens", () => {
  it("round-trips every frozen quote field", () => {
    const token = createToken();

    const quote = verifyAirwallexPaymentQuoteToken({
      token,
      userId: "user_123",
      displayCurrency: "USD",
      now: new Date(NOW.getTime() + 60_000),
    });

    expect(quote).toMatchObject({
      baseCurrency: "USD",
      displayCurrency: "USD",
      paymentCurrency: "USD",
      stale: false,
    });
    expect(quote.baseAmount.toFixed(2)).toBe("1250.00");
    expect(quote.paymentAmount.toFixed(2)).toBe("1250.00");
    expect(quote.exchangeRate.toFixed()).toBe("1");
    expect(quote.exchangeRateAt.toISOString()).toBe(
      "2026-08-22T11:58:00.000Z",
    );
  });

  it("rejects a token whose signed payload was tampered with", () => {
    const token = createToken();
    const [payload, signature] = token.split(".");
    const replacement = payload.endsWith("A") ? "B" : "A";
    const tampered = `${payload.slice(0, -1)}${replacement}.${signature}`;

    expect(() =>
      verifyAirwallexPaymentQuoteToken({
        token: tampered,
        userId: "user_123",
        displayCurrency: "USD",
        now: NOW,
      }),
    ).toThrow(AirwallexValidationError);
  });

  it("rejects a token presented by another user", () => {
    const token = createToken();

    expect(() =>
      verifyAirwallexPaymentQuoteToken({
        token,
        userId: "user_456",
        displayCurrency: "USD",
        now: NOW,
      }),
    ).toThrow(AirwallexValidationError);
  });

  it("binds a guest quote to its opaque checkout identity", () => {
    vi.stubEnv("AUTH_SECRET", SECRET);
    const guestPrincipal = `guest:${"a".repeat(64)}`;
    const token = createAirwallexPaymentQuoteToken({ userId: guestPrincipal, quote: makeQuote(), now: NOW });

    expect(verifyAirwallexPaymentQuoteToken({ token, userId: guestPrincipal, displayCurrency: "USD", now: NOW }).paymentAmount.toFixed(2)).toBe("1250.00");
    for (const otherPrincipal of [`guest:${"b".repeat(64)}`, "user_123"]) {
      expect(() => verifyAirwallexPaymentQuoteToken({ token, userId: otherPrincipal, displayCurrency: "USD", now: NOW })).toThrow(AirwallexValidationError);
    }
  });

  it("rejects a token under another storefront currency", () => {
    const token = createToken();

    expect(() =>
      verifyAirwallexPaymentQuoteToken({
        token,
        userId: "user_123",
        displayCurrency: "GBP",
        now: NOW,
      }),
    ).toThrow(AirwallexValidationError);
  });

  it("expires exactly after the 15-minute validity window", () => {
    const token = createToken();

    expect(() =>
      verifyAirwallexPaymentQuoteToken({
        token,
        userId: "user_123",
        displayCurrency: "USD",
        now: new Date(
          NOW.getTime() + AIRWALLEX_PAYMENT_QUOTE_TOKEN_TTL_MS + 1,
        ),
      }),
    ).toThrow(AirwallexValidationError);
  });

  it.each(["", "not-a-token", "a.b.c", `${"a".repeat(2049)}.x`])(
    "rejects malformed input without exposing parser details (%j)",
    (token) => {
      vi.stubEnv("AUTH_SECRET", SECRET);

      expect(() =>
        verifyAirwallexPaymentQuoteToken({
          token,
          userId: "user_123",
          displayCurrency: "USD",
          now: NOW,
        }),
      ).toThrowError(new AirwallexValidationError(
        "Invalid or expired payment quote.",
      ));
    },
  );

  it.each([undefined, "too-short"])(
    "fails safely when AUTH_SECRET is missing or too short",
    (secret) => {
      if (secret === undefined) {
        vi.stubEnv("AUTH_SECRET", undefined);
      } else {
        vi.stubEnv("AUTH_SECRET", secret);
      }

      expect(() =>
        createAirwallexPaymentQuoteToken({
          userId: "user_123",
          quote: makeQuote(),
          now: NOW,
        }),
      ).toThrow(AirwallexConfigurationError);
    },
  );

  it("rejects a signed quote whose payment amount is inconsistent", () => {
    vi.stubEnv("AUTH_SECRET", SECRET);

    expect(() =>
      createAirwallexPaymentQuoteToken({
        userId: "user_123",
        quote: makeQuote({ paymentAmount: new Decimal("10.64") }),
        now: NOW,
      }),
    ).toThrow(AirwallexValidationError);
  });

  it("recomputes money when verifying even when an inconsistent payload is validly signed", () => {
    const token = createToken();
    const [encodedPayload] = token.split(".");
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    payload.pa = "10.64";
    const inconsistentPayload = Buffer.from(
      JSON.stringify(payload),
      "utf8",
    ).toString("base64url");
    const signature = createHmac("sha256", SECRET)
      .update(inconsistentPayload, "ascii")
      .digest("base64url");

    expect(() =>
      verifyAirwallexPaymentQuoteToken({
        token: `${inconsistentPayload}.${signature}`,
        userId: "user_123",
        displayCurrency: "USD",
        now: NOW,
      }),
    ).toThrow(AirwallexValidationError);
  });
});
