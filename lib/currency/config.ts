/** Sole currency accepted for new catalog prices and transactions. */
export const BASE_CURRENCY = "USD" as const;
export const DISPLAY_LOCALE = "en-US" as const;
export const SUPPORTED_CURRENCIES = [BASE_CURRENCY] as const;
export type TransactionCurrency = typeof BASE_CURRENCY;

/** Read-only support for immutable historical financial snapshots. */
export const HISTORICAL_CURRENCIES = ["BDT", "AUD", "EUR", "GBP", "USD", "CNY"] as const;
export type CurrencyCode = (typeof HISTORICAL_CURRENCIES)[number];
export const CURRENCY_CONFIG = Object.fromEntries(
  HISTORICAL_CURRENCIES.map((code) => [code, { code, decimals: 2 as const }]),
) as Record<CurrencyCode, { readonly code: CurrencyCode; readonly decimals: 2 }>;

export function isCurrencyCode(value: unknown): value is TransactionCurrency {
  return value === BASE_CURRENCY;
}
export function parseCurrencyCode(value: unknown): TransactionCurrency | null {
  return isCurrencyCode(value) ? value : null;
}
export function isHistoricalCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === "string" && (HISTORICAL_CURRENCIES as readonly string[]).includes(value);
}
export function parseHistoricalCurrencyCode(value: unknown): CurrencyCode | null {
  return isHistoricalCurrencyCode(value) ? value : null;
}

export type CurrencyContext = {
  baseCurrency: TransactionCurrency;
  currency: TransactionCurrency;
  exchangeRate: "1";
  exchangeRateTimestamp: null;
  countryCode: null;
  source: "fixed";
  /** Shared availability state for existing catalog and shopping-cache consumers. */
  pricingReady?: boolean;
};
export type PricingContext = CurrencyContext;
export const DEFAULT_CURRENCY_CONTEXT = Object.freeze({
  baseCurrency: BASE_CURRENCY,
  currency: BASE_CURRENCY,
  exchangeRate: "1",
  exchangeRateTimestamp: null,
  countryCode: null,
  source: "fixed",
  pricingReady: true,
} as const satisfies CurrencyContext);
