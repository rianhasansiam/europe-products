import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { Decimal } from "@prisma/client/runtime/client";

import {
  BASE_CURRENCY,
  CURRENCY_CONFIG,
  parseCurrencyCode,
  type CurrencyCode,
} from "@/lib/currency/config";

import {
  AirwallexConfigurationError,
  AirwallexValidationError,
} from "../errors/airwallex.errors";
import {
  createAirwallexPaymentQuote,
  resolveAirwallexPaymentCurrency,
  type AirwallexPaymentCurrency,
  type AirwallexPaymentQuote,
} from "../services/airwallex-currency.service";

export const AIRWALLEX_PAYMENT_QUOTE_TOKEN_TTL_MS = 15 * 60 * 1_000;

const TOKEN_VERSION = 1 as const;
const MAX_TOKEN_LENGTH = 2_048;
const MAX_PAYLOAD_LENGTH = 1_536;
const MAX_USER_ID_LENGTH = 191;
const MAX_SECRET_LENGTH = 4_096;
const SIGNATURE_LENGTH = 43;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const MONEY_PATTERN = /^(?:0|[1-9]\d{0,15})\.\d{2}$/;
const RATE_PATTERN = /^(?:0|[1-9]\d{0,19})(?:\.\d{1,20})?$/;
const INVALID_QUOTE_MESSAGE = "Invalid or expired payment quote.";

type AirwallexPaymentQuoteTokenPayload = {
  v: typeof TOKEN_VERSION;
  uid: string;
  iat: number;
  exp: number;
  bc: typeof BASE_CURRENCY;
  ba: string;
  dc: CurrencyCode;
  pc: AirwallexPaymentCurrency;
  pa: string;
  xr: string;
  xat: string;
  st: boolean;
};

const PAYLOAD_KEYS = [
  "ba",
  "bc",
  "dc",
  "exp",
  "iat",
  "pa",
  "pc",
  "st",
  "uid",
  "v",
  "xat",
  "xr",
] as const;

function invalidQuote(): never {
  throw new AirwallexValidationError(INVALID_QUOTE_MESSAGE);
}

function getSigningSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (
    typeof secret !== "string" ||
    secret.length < 32 ||
    secret.length > MAX_SECRET_LENGTH ||
    secret.trim().length < 32
  ) {
    throw new AirwallexConfigurationError();
  }
  return secret;
}

function requireUserId(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_USER_ID_LENGTH ||
    value.trim() !== value
  ) {
    invalidQuote();
  }
  return value;
}

function requireNowMs(now: Date): number {
  if (!(now instanceof Date) || !Number.isSafeInteger(now.getTime())) {
    invalidQuote();
  }
  return now.getTime();
}

function serializePayload(
  payload: AirwallexPaymentQuoteTokenPayload,
): string {
  return JSON.stringify(payload);
}

function encodePayload(payload: AirwallexPaymentQuoteTokenPayload): string {
  return Buffer.from(serializePayload(payload), "utf8").toString("base64url");
}

function signPayload(encodedPayload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(encodedPayload, "ascii").digest();
}

function canonicalizeQuote(quote: AirwallexPaymentQuote): {
  quote: AirwallexPaymentQuote;
  baseAmount: string;
  paymentAmount: string;
  exchangeRate: string;
  exchangeRateAt: string;
} {
  try {
    const displayCurrency = parseCurrencyCode(quote.displayCurrency);
    const paymentCurrency = resolveAirwallexPaymentCurrency(
      quote.displayCurrency,
    );
    if (
      quote.baseCurrency !== BASE_CURRENCY ||
      !displayCurrency ||
      quote.paymentCurrency !== paymentCurrency ||
      !(quote.baseAmount instanceof Decimal) ||
      !(quote.paymentAmount instanceof Decimal) ||
      !(quote.exchangeRate instanceof Decimal) ||
      !(quote.exchangeRateAt instanceof Date) ||
      typeof quote.stale !== "boolean" ||
      !quote.baseAmount.isFinite() ||
      !quote.baseAmount.isPositive() ||
      !quote.paymentAmount.isFinite() ||
      !quote.paymentAmount.isPositive() ||
      !quote.exchangeRate.isFinite() ||
      !quote.exchangeRate.isPositive()
    ) {
      invalidQuote();
    }

    const baseAmount = quote.baseAmount.toFixed(
      CURRENCY_CONFIG[BASE_CURRENCY].decimals,
    );
    const paymentAmount = quote.paymentAmount.toFixed(
      CURRENCY_CONFIG[paymentCurrency].decimals,
    );
    const exchangeRate = quote.exchangeRate.toFixed();
    const exchangeRateAt = quote.exchangeRateAt.toISOString();
    if (
      !MONEY_PATTERN.test(baseAmount) ||
      !MONEY_PATTERN.test(paymentAmount) ||
      exchangeRate.length > 64 ||
      !RATE_PATTERN.test(exchangeRate)
    ) {
      invalidQuote();
    }

    const recomputed = createAirwallexPaymentQuote({
      baseAmount,
      displayCurrency,
      paymentRate: {
        baseCurrency: BASE_CURRENCY,
        displayCurrency,
        paymentCurrency,
        exchangeRate,
        exchangeRateTimestamp: exchangeRateAt,
        stale: quote.stale,
      },
    });
    if (
      !recomputed.baseAmount.equals(quote.baseAmount) ||
      !recomputed.paymentAmount.equals(quote.paymentAmount) ||
      !recomputed.exchangeRate.equals(quote.exchangeRate) ||
      recomputed.exchangeRateAt.getTime() !== quote.exchangeRateAt.getTime()
    ) {
      invalidQuote();
    }

    return {
      quote: recomputed,
      baseAmount,
      paymentAmount,
      exchangeRate,
      exchangeRateAt,
    };
  } catch (error) {
    if (
      error instanceof AirwallexValidationError &&
      error.message === INVALID_QUOTE_MESSAGE
    ) {
      throw error;
    }
    invalidQuote();
  }
}

function hasExactPayloadKeys(
  value: Record<string, unknown>,
): boolean {
  const keys = Object.keys(value).sort();
  return (
    keys.length === PAYLOAD_KEYS.length &&
    keys.every((key, index) => key === PAYLOAD_KEYS[index])
  );
}

function parsePayload(
  encodedPayload: string,
): AirwallexPaymentQuoteTokenPayload {
  let rawPayload: string;
  let value: unknown;
  try {
    rawPayload = Buffer.from(encodedPayload, "base64url").toString("utf8");
    if (
      rawPayload.length === 0 ||
      rawPayload.length > MAX_PAYLOAD_LENGTH ||
      Buffer.from(rawPayload, "utf8").toString("base64url") !== encodedPayload
    ) {
      invalidQuote();
    }
    value = JSON.parse(rawPayload);
  } catch {
    invalidQuote();
  }

  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    !hasExactPayloadKeys(value as Record<string, unknown>)
  ) {
    invalidQuote();
  }
  const candidate = value as Record<string, unknown>;
  const displayCurrency = parseCurrencyCode(candidate.dc);
  const paymentCurrency =
    typeof candidate.pc === "string"
      ? resolveAirwallexPaymentCurrency(displayCurrency ?? "")
      : null;
  if (
    candidate.v !== TOKEN_VERSION ||
    typeof candidate.iat !== "number" ||
    !Number.isSafeInteger(candidate.iat) ||
    typeof candidate.exp !== "number" ||
    !Number.isSafeInteger(candidate.exp) ||
    candidate.exp - candidate.iat !== AIRWALLEX_PAYMENT_QUOTE_TOKEN_TTL_MS ||
    candidate.bc !== BASE_CURRENCY ||
    !displayCurrency ||
    candidate.pc !== paymentCurrency ||
    typeof candidate.ba !== "string" ||
    !MONEY_PATTERN.test(candidate.ba) ||
    typeof candidate.pa !== "string" ||
    !MONEY_PATTERN.test(candidate.pa) ||
    typeof candidate.xr !== "string" ||
    candidate.xr.length > 64 ||
    !RATE_PATTERN.test(candidate.xr) ||
    typeof candidate.xat !== "string" ||
    candidate.xat.length !== 24 ||
    typeof candidate.st !== "boolean"
  ) {
    invalidQuote();
  }
  requireUserId(candidate.uid);

  const exchangeRateAt = new Date(candidate.xat as string);
  if (
    !Number.isFinite(exchangeRateAt.getTime()) ||
    exchangeRateAt.toISOString() !== candidate.xat
  ) {
    invalidQuote();
  }
  try {
    const rate = new Decimal(candidate.xr as string);
    if (
      !rate.isFinite() ||
      !rate.isPositive() ||
      rate.toFixed() !== candidate.xr
    ) {
      invalidQuote();
    }
  } catch {
    invalidQuote();
  }

  const payload = candidate as AirwallexPaymentQuoteTokenPayload;
  if (serializePayload(payload) !== rawPayload) {
    invalidQuote();
  }
  return payload;
}

export function createAirwallexPaymentQuoteToken({
  userId,
  quote,
  now = new Date(),
}: {
  userId: string;
  quote: AirwallexPaymentQuote;
  now?: Date;
}): string {
  const secret = getSigningSecret();
  const safeUserId = requireUserId(userId);
  const issuedAt = requireNowMs(now);
  const normalized = canonicalizeQuote(quote);
  const payload: AirwallexPaymentQuoteTokenPayload = {
    v: TOKEN_VERSION,
    uid: safeUserId,
    iat: issuedAt,
    exp: issuedAt + AIRWALLEX_PAYMENT_QUOTE_TOKEN_TTL_MS,
    bc: normalized.quote.baseCurrency,
    ba: normalized.baseAmount,
    dc: normalized.quote.displayCurrency,
    pc: normalized.quote.paymentCurrency,
    pa: normalized.paymentAmount,
    xr: normalized.exchangeRate,
    xat: normalized.exchangeRateAt,
    st: normalized.quote.stale,
  };
  const encodedPayload = encodePayload(payload);
  const signature = signPayload(encodedPayload, secret).toString("base64url");
  return `${encodedPayload}.${signature}`;
}

export function verifyAirwallexPaymentQuoteToken({
  token,
  userId,
  displayCurrency,
  now = new Date(),
}: {
  token: string;
  userId: string;
  displayCurrency: CurrencyCode;
  now?: Date;
}): AirwallexPaymentQuote {
  const secret = getSigningSecret();
  const safeUserId = requireUserId(userId);
  const safeDisplayCurrency = parseCurrencyCode(displayCurrency);
  const nowMs = requireNowMs(now);
  if (
    !safeDisplayCurrency ||
    typeof token !== "string" ||
    token.length === 0 ||
    token.length > MAX_TOKEN_LENGTH
  ) {
    invalidQuote();
  }

  const parts = token.split(".");
  if (
    parts.length !== 2 ||
    parts[0].length === 0 ||
    parts[0].length > MAX_PAYLOAD_LENGTH ||
    parts[1].length !== SIGNATURE_LENGTH ||
    !BASE64URL_PATTERN.test(parts[0]) ||
    !BASE64URL_PATTERN.test(parts[1])
  ) {
    invalidQuote();
  }

  const expectedSignature = signPayload(parts[0], secret);
  const receivedSignature = Buffer.from(parts[1], "base64url");
  if (
    receivedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(receivedSignature, expectedSignature)
  ) {
    invalidQuote();
  }

  const payload = parsePayload(parts[0]);
  if (
    payload.uid !== safeUserId ||
    payload.dc !== safeDisplayCurrency ||
    nowMs < payload.iat ||
    nowMs > payload.exp
  ) {
    invalidQuote();
  }

  const quote = createAirwallexPaymentQuote({
    baseAmount: payload.ba,
    displayCurrency: payload.dc,
    paymentRate: {
      baseCurrency: payload.bc,
      displayCurrency: payload.dc,
      paymentCurrency: payload.pc,
      exchangeRate: payload.xr,
      exchangeRateTimestamp: payload.xat,
      stale: payload.st,
    },
  });
  const normalized = canonicalizeQuote(quote);
  if (
    normalized.baseAmount !== payload.ba ||
    normalized.paymentAmount !== payload.pa ||
    normalized.exchangeRate !== payload.xr ||
    normalized.exchangeRateAt !== payload.xat
  ) {
    invalidQuote();
  }
  return normalized.quote;
}
