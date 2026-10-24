import type {
  OrderPaymentMethod,
  PaymentStatus,
} from "@/features/orders/api";
import {
  isHistoricalCurrencyCode,
  type CurrencyCode,
} from "@/lib/currency/config";

export const PAYMENT_STATUS_META = {
  PAID: {
    label: "Paid",
    pill: "bg-emerald-100 text-emerald-700",
    ring: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  UNPAID: {
    label: "Awaiting payment",
    pill: "bg-amber-100 text-amber-700",
    ring: "bg-amber-50 text-amber-700 ring-amber-200",
  },
  PENDING: {
    label: "Processing",
    pill: "bg-sky-100 text-sky-700",
    ring: "bg-sky-50 text-sky-700 ring-sky-200",
  },
  FAILED: {
    label: "Payment failed",
    pill: "bg-rose-100 text-rose-700",
    ring: "bg-rose-50 text-rose-700 ring-rose-200",
  },
  REFUNDED: {
    label: "Refunded",
    pill: "bg-slate-100 text-slate-700",
    ring: "bg-slate-50 text-slate-700 ring-slate-200",
  },
} as const satisfies Record<
  PaymentStatus,
  { label: string; pill: string; ring: string }
>;

export function paymentMethodLabel(
  method: OrderPaymentMethod | string,
): string {
  switch (method) {
    case "CASH_ON_DELIVERY":
      return "Cash on delivery";
    case "SSLCOMMERZ":
      return "SSLCommerz (Visa / Mastercard)";
    case "AIRWALLEX":
      return "Airwallex secure payment";
    case "PAYPAL":
      return "PayPal";
    case "ONLINE":
      return "Online payment";
    default:
      return method;
  }
}

export function isAwaitingAirwallexConfirmation(
  method: OrderPaymentMethod,
  status: PaymentStatus,
): boolean {
  return (
    method === "AIRWALLEX" &&
    (status === "PENDING" || status === "UNPAID")
  );
}

export type AirwallexPaymentDisplay = {
  amount: number;
  currency: CurrencyCode;
};

/**
 * Treat API JSON as untrusted at the render boundary. This prevents a stale
 * deployment or malformed legacy response from passing `undefined`/an unknown
 * currency into the strict money formatter.
 */
export function getAirwallexPaymentDisplay(input: {
  paymentMethod: OrderPaymentMethod | string;
  paymentAmount: unknown;
  paymentCurrency: unknown;
  displayAmount: number;
  displayCurrency: CurrencyCode;
}): AirwallexPaymentDisplay | null {
  if (
    input.paymentMethod !== "AIRWALLEX" ||
    typeof input.paymentAmount !== "number" ||
    !Number.isFinite(input.paymentAmount) ||
    input.paymentAmount <= 0 ||
    !isHistoricalCurrencyCode(input.paymentCurrency)
  ) {
    return null;
  }

  if (
    input.paymentCurrency === input.displayCurrency &&
    input.paymentAmount === input.displayAmount
  ) {
    return null;
  }

  return {
    amount: input.paymentAmount,
    currency: input.paymentCurrency,
  };
}
