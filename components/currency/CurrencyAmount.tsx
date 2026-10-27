"use client";

import type { ComponentPropsWithoutRef } from "react";
import { useLocale } from "next-intl";

import { formatMoney } from "@/lib/currency/format-money";
import { priceAmount } from "@/lib/currency/pricing.service";

import { useCurrency } from "./CurrencyProvider";

type CurrencyAmountProps = Omit<
  ComponentPropsWithoutRef<"span">,
  "children"
> & {
  /** A final display amount in the USD currency. */
  amountUSD: number | string;
};

/** Formats a USD catalog amount. */
export function CurrencyAmount({ amountUSD, ...props }: CurrencyAmountProps) {
  const context = useCurrency();
  const locale = useLocale();
  if (context.pricingReady === false) return <span {...props}>Price unavailable</span>;
  const price = priceAmount({ baseAmount: amountUSD, context });

  return <span dir="auto" {...props}>{formatMoney(price.amount, price.currency, { locale })}</span>;
}

export default CurrencyAmount;
