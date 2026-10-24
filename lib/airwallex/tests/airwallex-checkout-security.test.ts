import { Decimal } from "@prisma/client/runtime/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { checkoutSchema } from "@/lib/validations/checkout.validation";

import { createAirwallexPaymentQuoteToken } from "../security/airwallex-payment-quote-token";

const IDEMPOTENCY_KEY = "123e4567-e89b-42d3-a456-426614174000";
const AUTH_SECRET = "checkout-security-test-secret-is-at-least-32-characters";

function makeValidAirwallexCheckout() {
  vi.stubEnv("AUTH_SECRET", AUTH_SECRET);
  const airwallexQuoteToken = createAirwallexPaymentQuoteToken({
    userId: "user-1",
    now: new Date("2026-08-22T12:00:00.000Z"),
    quote: {
      baseCurrency: "USD",
      baseAmount: new Decimal("1250.00"),
      displayCurrency: "USD",
      paymentCurrency: "USD",
      paymentAmount: new Decimal("1250.00"),
      exchangeRate: new Decimal("1"),
      exchangeRateAt: new Date("2026-08-22T11:58:00.000Z"),
      stale: false,
    },
  });

  return {
    customerName: "Test Customer",
    customerPhone: "+8801700000000",
    customerAddress: "123 Test Street, Dhaka",
    paymentMethod: "AIRWALLEX" as const,
    idempotencyKey: IDEMPOTENCY_KEY,
    airwallexQuoteToken,
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Airwallex checkout input authority", () => {
  it("strips browser-supplied money fields from the validated checkout", () => {
    const validAirwallexCheckout = makeValidAirwallexCheckout();
    const browserMoney = {
      amount: 0.01,
      currency: "USD",
      convertedAmount: 0.01,
      total: 0.01,
    };
    const parsed = checkoutSchema.parse({
      ...validAirwallexCheckout,
      ...browserMoney,
      items: [
        {
          productId: "product-1",
          quantity: 1,
          ...browserMoney,
        },
      ],
    });

    expect(parsed).toEqual({
      ...validAirwallexCheckout,
      items: [{ productId: "product-1", quantity: 1 }],
      deliveryZone: "INSIDE_DHAKA",
      clearCart: true,
    });
    expect(parsed).not.toHaveProperty("amount");
    expect(parsed).not.toHaveProperty("currency");
    expect(parsed).not.toHaveProperty("convertedAmount");
    expect(parsed).not.toHaveProperty("total");
  });

  it.each([
    ["idempotencyKey", "A payment request ID is required for online payment."],
    [
      "airwallexQuoteToken",
      "Refresh checkout to obtain a secure payment quote.",
    ],
  ] as const)("requires %s for AIRWALLEX", (missingField, message) => {
    const validAirwallexCheckout = makeValidAirwallexCheckout();
    const input: Record<string, unknown> = { ...validAirwallexCheckout };
    delete input[missingField];

    const result = checkoutSchema.safeParse(input);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: [missingField], message }),
      ]),
    );
  });
});
