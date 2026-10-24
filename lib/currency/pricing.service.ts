import type { DecimalInput } from "@/lib/money";
import { DEFAULT_CURRENCY_CONTEXT, type CurrencyContext } from "./config";
import { normalizeDecimalInput, roundDecimalHalfUp } from "./decimal";

export type CreatePricingContextInput = {
  currency?: unknown;
  exchangeRate?: DecimalInput;
  exchangeRateTimestamp?: string | Date | null;
  countryCode?: unknown;
  source?: unknown;
  pricingReady?: boolean;
};

/** Client input, cookies, and location never choose a transaction currency. */
export function createPricingContext(input: CreatePricingContextInput = {}): CurrencyContext {
  return { ...DEFAULT_CURRENCY_CONTEXT, ...(input.pricingReady === undefined ? {} : { pricingReady: input.pricingReady }) };
}

export function normalizePrice({ amount }: { amount: DecimalInput; context?: CurrencyContext }): number {
  const value = normalizeDecimalInput(amount);
  if (value.startsWith("-")) throw new RangeError("Price cannot be negative");
  return roundDecimalHalfUp(value, 2);
}

/** Normalize an already USD-denominated amount; no currency conversion is performed. */
export function priceAmount({ baseAmount, context }: { baseAmount: DecimalInput; context: CurrencyContext }) {
  const amount = normalizePrice({ amount: baseAmount });
  return { ...createPricingContext(context), baseAmount: amount, amount };
}
