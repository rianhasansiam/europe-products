import type { DecimalInput } from "@/lib/money";

import type { CurrencyContext } from "@/lib/currency/config";
import { createPricingContext, priceAmount } from "@/lib/currency/pricing.service";

export type CanonicalOrderAmounts = {
  subtotal: DecimalInput;
  discount: DecimalInput;
  shipping: DecimalInput;
  tax: DecimalInput;
  total: DecimalInput;
  advancePayment?: DecimalInput;
};

export type OrderCurrencySnapshot = {
  baseCurrency: "USD";
  displayCurrency: CurrencyContext["currency"];
  exchangeRate: string;
  exchangeRateAt: string | null;
  displaySubtotal: number;
  displayDiscountAmount: number;
  displayDeliveryCharge: number;
  displayTaxAmount: number;
  displayTotalAmount: number;
  displayAdvancePayment: number;
};

function displayAmount(amount: DecimalInput, context: CurrencyContext): number {
  return priceAmount({ baseAmount: amount, context }).amount;
}

/**
 * Snapshot already-final USD components and return the
 * immutable values persisted with a new order. Business rules never consume
 * this display snapshot.
 */
export function createOrderCurrencySnapshot(
  amounts: CanonicalOrderAmounts,
  context: CurrencyContext,
): OrderCurrencySnapshot {
  const safeContext = createPricingContext(context);

  return {
    baseCurrency: safeContext.baseCurrency,
    displayCurrency: safeContext.currency,
    exchangeRate: safeContext.exchangeRate,
    exchangeRateAt: safeContext.exchangeRateTimestamp,
    displaySubtotal: displayAmount(amounts.subtotal, safeContext),
    displayDiscountAmount: displayAmount(amounts.discount, safeContext),
    displayDeliveryCharge: displayAmount(amounts.shipping, safeContext),
    displayTaxAmount: displayAmount(amounts.tax, safeContext),
    displayTotalAmount: displayAmount(amounts.total, safeContext),
    displayAdvancePayment: displayAmount(
      amounts.advancePayment ?? 0,
      safeContext,
    ),
  };
}

export type OrderItemCurrencySnapshot = {
  displayUnitPrice: number;
  displayTotalPrice: number;
};

/** Snapshot an order line using the same immutable quote as its order. */
export function createOrderItemCurrencySnapshot(
  input: { unitPrice: DecimalInput; totalPrice: DecimalInput },
  context: CurrencyContext,
): OrderItemCurrencySnapshot {
  const safeContext = createPricingContext(context);
  return {
    displayUnitPrice: displayAmount(input.unitPrice, safeContext),
    displayTotalPrice: displayAmount(input.totalPrice, safeContext),
  };
}
