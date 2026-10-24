import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";
import { Decimal } from "@prisma/client/runtime/client";
import { BASE_CURRENCY, parseHistoricalCurrencyCode, type CurrencyCode, type CurrencyContext } from "@/lib/currency/config";
import type { DecimalInput } from "@/lib/money";
import { toDecimal } from "@/lib/money";
import { AirwallexValidationError } from "../errors/airwallex.errors";

export const DIRECT_AIRWALLEX_PAYMENT_CURRENCIES = [BASE_CURRENCY] as const;
export type AirwallexPaymentCurrency = typeof BASE_CURRENCY;

/** Every newly created PaymentIntent is denominated in USD. */
export function resolveAirwallexPaymentCurrency(_storefrontCurrency: string): AirwallexPaymentCurrency {
  void _storefrontCurrency;
  return BASE_CURRENCY;
}

export type AirwallexPaymentRate = {
  baseCurrency: typeof BASE_CURRENCY;
  displayCurrency: CurrencyCode;
  paymentCurrency: AirwallexPaymentCurrency;
  exchangeRate: string;
  exchangeRateTimestamp: string;
  stale: boolean;
};

export type AirwallexPaymentQuote = {
  baseCurrency: typeof BASE_CURRENCY;
  baseAmount: Prisma.Decimal;
  displayCurrency: CurrencyCode;
  paymentCurrency: AirwallexPaymentCurrency;
  paymentAmount: Prisma.Decimal;
  exchangeRate: Prisma.Decimal;
  exchangeRateAt: Date;
  stale: boolean;
};

export type PublicAirwallexPaymentQuote = {
  baseCurrency: typeof BASE_CURRENCY;
  baseAmount: number;
  displayCurrency: CurrencyCode;
  paymentCurrency: AirwallexPaymentCurrency;
  paymentAmount: number;
  exchangeRate: string;
  exchangeRateTimestamp: string;
};

/** USD is already the canonical price; no network quote or conversion is used. */
export async function resolveAirwallexPaymentRate(_displayContext: CurrencyContext): Promise<AirwallexPaymentRate> {
  void _displayContext;
  return {
    baseCurrency: BASE_CURRENCY,
    displayCurrency: BASE_CURRENCY,
    paymentCurrency: BASE_CURRENCY,
    exchangeRate: "1",
    exchangeRateTimestamp: new Date().toISOString(),
    stale: false,
  };
}

export function createAirwallexPaymentQuote(input: {
  baseAmount: DecimalInput;
  displayCurrency: CurrencyCode;
  paymentRate: AirwallexPaymentRate;
}): AirwallexPaymentQuote {
  const amount = toDecimal(input.baseAmount);
  const timestamp = new Date(input.paymentRate.exchangeRateTimestamp);
  if (!amount.isFinite() || !amount.isPositive() ||
      input.displayCurrency !== BASE_CURRENCY ||
      input.paymentRate.baseCurrency !== BASE_CURRENCY ||
      input.paymentRate.displayCurrency !== BASE_CURRENCY ||
      input.paymentRate.paymentCurrency !== BASE_CURRENCY ||
      !toDecimal(input.paymentRate.exchangeRate).equals(1) ||
      !Number.isFinite(timestamp.getTime())) {
    throw new AirwallexValidationError("Invalid USD payment quote.");
  }
  const rounded = amount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  if (!rounded.isPositive()) throw new AirwallexValidationError("The order total cannot be paid online.");
  return {
    baseCurrency: BASE_CURRENCY,
    baseAmount: rounded,
    displayCurrency: BASE_CURRENCY,
    paymentCurrency: BASE_CURRENCY,
    paymentAmount: rounded,
    exchangeRate: toDecimal(1),
    exchangeRateAt: timestamp,
    stale: false,
  };
}

export async function quoteAirwallexPayment(input: {
  baseAmount: DecimalInput;
  displayContext: CurrencyContext;
}): Promise<AirwallexPaymentQuote> {
  return createAirwallexPaymentQuote({
    baseAmount: input.baseAmount,
    displayCurrency: BASE_CURRENCY,
    paymentRate: await resolveAirwallexPaymentRate(input.displayContext),
  });
}

export function toPublicAirwallexPaymentQuote(quote: AirwallexPaymentQuote): PublicAirwallexPaymentQuote {
  return {
    baseCurrency: quote.baseCurrency,
    baseAmount: quote.baseAmount.toNumber(),
    displayCurrency: quote.displayCurrency,
    paymentCurrency: quote.paymentCurrency,
    paymentAmount: quote.paymentAmount.toNumber(),
    exchangeRate: quote.exchangeRate.toString(),
    exchangeRateTimestamp: quote.exchangeRateAt.toISOString(),
  };
}

export type AirwallexPaymentQuoteMismatch = "AMOUNT_MISMATCH" | "CURRENCY_MISMATCH" | "PAYMENT_QUOTE_MISMATCH";

/** Historical records are verified against their original frozen currency and rate. */
export function findAirwallexPaymentQuoteMismatch(input: {
  canonicalBaseAmount: DecimalInput;
  displayCurrency: string;
  baseAmount: DecimalInput;
  baseCurrency: string | null;
  paymentAmount: DecimalInput;
  paymentCurrency: string;
  exchangeRate: DecimalInput;
  exchangeRateAt: Date | string | null;
}): AirwallexPaymentQuoteMismatch | null {
  const baseCurrency = parseHistoricalCurrencyCode(input.baseCurrency?.trim().toUpperCase());
  const paymentCurrency = parseHistoricalCurrencyCode(input.paymentCurrency.trim().toUpperCase());
  const displayCurrency = parseHistoricalCurrencyCode(input.displayCurrency.trim().toUpperCase());
  if (!baseCurrency || !paymentCurrency || !displayCurrency) return "CURRENCY_MISMATCH";
  if (baseCurrency === BASE_CURRENCY && (paymentCurrency !== BASE_CURRENCY || displayCurrency !== BASE_CURRENCY)) return "CURRENCY_MISMATCH";
  // Pre-USD orders used BDT as their canonical currency. Preserve their policy
  // only when checking existing records; initiation never creates new BDT charges.
  if (baseCurrency === "BDT") {
    const legacyPaymentCurrency = ["EUR", "GBP", "USD", "CNY"].includes(displayCurrency) ? displayCurrency : "USD";
    if (paymentCurrency !== legacyPaymentCurrency) return "CURRENCY_MISMATCH";
  }
  try {
    const canonical = toDecimal(input.canonicalBaseAmount);
    const base = toDecimal(input.baseAmount);
    const payment = toDecimal(input.paymentAmount);
    const rate = toDecimal(input.exchangeRate);
    const timestamp = input.exchangeRateAt ? new Date(input.exchangeRateAt) : null;
    if (!canonical.isFinite() || !canonical.isPositive() || !base.equals(canonical) || !payment.isFinite() || !payment.isPositive()) return "AMOUNT_MISMATCH";
    if (!rate.isFinite() || !rate.isPositive() || !timestamp || !Number.isFinite(timestamp.getTime()) || (baseCurrency === BASE_CURRENCY && !rate.equals(1))) return "PAYMENT_QUOTE_MISMATCH";
    return canonical.times(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).equals(payment) ? null : "AMOUNT_MISMATCH";
  } catch {
    return "PAYMENT_QUOTE_MISMATCH";
  }
}
