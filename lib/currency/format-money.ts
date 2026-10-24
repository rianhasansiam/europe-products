import type { DecimalInput } from "@/lib/money";

import type { CurrencyCode } from "./config";
import {
  CURRENCY_CONFIG,
  DISPLAY_LOCALE,
  isHistoricalCurrencyCode,
} from "./config";
import { decimalInputToFiniteNumber } from "./decimal";

export type FormatMoneyOptions = {
  locale?: string;
  currencyDisplay?: Intl.NumberFormatOptions["currencyDisplay"];
};

/** Format a validated amount through Intl; currency symbols are never manual. */
export function formatMoney(
  amount: DecimalInput,
  currency: CurrencyCode,
  options: FormatMoneyOptions = {},
): string {
  if (!isHistoricalCurrencyCode(currency)) {
    throw new TypeError("Unsupported currency code");
  }

  let numericAmount: number;
  try {
    numericAmount = decimalInputToFiniteNumber(amount);
  } catch {
    throw new TypeError("Amount must be a finite, valid decimal value");
  }

  const config = CURRENCY_CONFIG[currency];
  return new Intl.NumberFormat(options.locale ?? DISPLAY_LOCALE, {
    style: "currency",
    currency,
    currencyDisplay: options.currencyDisplay ?? "symbol",
    minimumFractionDigits: config.decimals,
    maximumFractionDigits: config.decimals,
  }).format(numericAmount);
}
