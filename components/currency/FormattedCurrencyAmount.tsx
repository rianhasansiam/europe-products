"use client";

import type { ComponentPropsWithoutRef } from "react";
import { useLocale } from "next-intl";

import type { CurrencyCode } from "@/lib/currency/config";
import { formatMoney } from "@/lib/currency/format-money";
import type { DecimalInput } from "@/lib/money";

type FormattedCurrencyAmountProps = Omit<
  ComponentPropsWithoutRef<"span">,
  "children"
> & {
  /** An amount that is already converted into `currency`. */
  amount: DecimalInput;
  currency: CurrencyCode;
};

/** Formats an already-converted amount without applying another FX rate. */
export function FormattedCurrencyAmount({
  amount,
  currency,
  ...props
}: FormattedCurrencyAmountProps) {
  const locale = useLocale();
  return <span dir="auto" {...props}>{formatMoney(amount, currency, { locale })}</span>;
}

export default FormattedCurrencyAmount;
