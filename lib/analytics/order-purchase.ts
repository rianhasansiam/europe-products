import "server-only";

import type { CommerceItem } from "@/lib/analytics/ecommerce";
import { BASE_CURRENCY, parseHistoricalCurrencyCode } from "@/lib/currency/config";
import { round2, toDecimal, type DecimalInput } from "@/lib/money";
import { validatePurchaseSnapshot, type PurchaseSnapshot } from "./purchase-payload";
import { logPurchaseDiagnostic } from "./purchase-diagnostics";

export type VerifiedPurchaseSnapshot = PurchaseSnapshot;

type OrderPurchaseSource = {
  id: string;
  userId: string | null;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  totalAmount: DecimalInput;
  currency: string;
  baseCurrency: string;
  items: readonly {
    productId: string | null;
    variantId: string | null;
    productName: string;
    sku: string | null;
    quantity: number;
    unitPrice: DecimalInput;
    product: { productCode: string } | null;
  }[];
  payments: readonly {
    provider: string;
    status: string;
    requiresReview: boolean;
    transactionId: string | null;
    validationId: string | null;
    providerStatus: string | null;
    paidAt: Date | null;
    amount: DecimalInput;
    currency: string;
    baseAmount: DecimalInput;
    baseCurrency: string | null;
    exchangeRate: DecimalInput;
  }[];
};

const CONFIRMED_ORDER_STATUSES = new Set([
  "PAYMENT_CONFIRMED", "SELLER_TO_PACK", "PACKED", "READY_TO_SHIP",
  "WAREHOUSE", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED",
]);

/** DB money is Decimal major units. Guard required inputs before null -> 0 utilities. */
function savedDecimal(value: DecimalInput, precision = 2) {
  if (value == null || (typeof value === "number" && !Number.isFinite(value))) return null;
  if (typeof value === "string" && !/^-?\d+(?:\.\d+)?$/.test(value)) return null;
  try {
    const decimal = toDecimal(value);
    return decimal.isFinite() && !decimal.isNegative() && decimal.decimalPlaces() <= precision
      ? decimal : null;
  } catch { return null; }
}

/**
 * This is derived only from persisted, provider-verified payment evidence.
 * Neither a return URL nor a manually marked COD/legacy payment is sufficient.
 * No provider identifiers, customer fields, or raw evidence cross the boundary.
 * Revenue is the saved checkout total (effective merchandise prices minus promo
 * discounts plus delivery and tax), in the verified transaction currency.
 */
export function buildVerifiedPurchaseSnapshot(
  order: OrderPurchaseSource,
): VerifiedPurchaseSnapshot | null {
  const eventId = `purchase:${order.id}`;
  const reject = (reason: string, validation: "invalid" | "ineligible" = "invalid") => {
    logPurchaseDiagnostic({ eventId, source: "server", validation, status: "suppressed", reason });
    return null;
  };
  try {
    if (
      !order.id || order.paymentStatus !== "PAID" ||
      !CONFIRMED_ORDER_STATUSES.has(order.status) ||
      !["SSLCOMMERZ", "AIRWALLEX"].includes(order.paymentMethod)
    ) return reject("ineligible_order", "ineligible");
    if (order.payments.some((payment) => payment.requiresReview)) return reject("payment_review", "ineligible");
    // Read-only historical evidence retains its original currency. New charge
    // creation is separately restricted to reviewed USD pricing and Airwallex.
    const baseCurrency = parseHistoricalCurrencyCode(order.baseCurrency);
    if (!baseCurrency || order.currency !== baseCurrency) return reject("unsupported_currency");

    const successes = order.payments.filter((payment) => payment.status === "SUCCESS");
    if (successes.length !== 1 || successes[0].provider !== order.paymentMethod) return reject("unverified_payment", "ineligible");
    const payment = successes[0];
    if (!payment.transactionId || !payment.paidAt || !Number.isFinite(payment.paidAt.getTime())) return reject("unverified_payment", "ineligible");
    if (order.paymentMethod === "SSLCOMMERZ" && !payment.validationId) return reject("unverified_payment", "ineligible");
    if (order.paymentMethod === "AIRWALLEX" && payment.providerStatus !== "SUCCEEDED") return reject("unverified_payment", "ineligible");

    const currency = parseHistoricalCurrencyCode(payment.currency);
    const amount = savedDecimal(payment.amount);
    const orderTotal = savedDecimal(order.totalAmount);
    if (!currency) return reject("unsupported_currency");
    if (!amount) return reject("invalid_payment_amount");
    if (!orderTotal) return reject("invalid_order_total");
    // The online payment integrations accept positive charges only. Free orders
    // are explicitly excluded from paid Purchase, rather than treated as missing.
    if (amount.isZero() || orderTotal.isZero()) return reject("zero_value_policy", "ineligible");

    // Reconcile immutable legacy quotes without fetching rates or converting
    // any stored financial amount. New USD evidence must be exact parity.
    let rate = toDecimal(1);
    if (order.paymentMethod === "SSLCOMMERZ") {
      if (currency !== baseCurrency || !amount.equals(orderTotal)) return reject("payment_mismatch");
    } else {
      if (payment.baseCurrency !== baseCurrency) return reject("unsupported_currency");
      const baseAmount = savedDecimal(payment.baseAmount);
      const savedRate = savedDecimal(payment.exchangeRate, 10);
      if (!baseAmount || !baseAmount.equals(orderTotal)) return reject("invalid_base_amount");
      if (!savedRate || savedRate.lessThanOrEqualTo(0)) return reject("invalid_exchange_rate");
      if (baseCurrency === BASE_CURRENCY && (currency !== BASE_CURRENCY || !savedRate.equals(1))) return reject("payment_mismatch");
      rate = savedRate;
      if (round2(orderTotal.times(rate)) !== round2(amount)) return reject("payment_mismatch");
    }

    const items: CommerceItem[] = [];
    for (const item of order.items) {
      const productCode = item.product?.productCode.trim();
      const price = savedDecimal(item.unitPrice);
      if (!item.productId || !productCode || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || !price) {
        logPurchaseDiagnostic({ eventId, source: "server", validation: "valid", status: "built", reason: "invalid_catalog_metadata" });
        // Catalog details are optional; do not replace authoritative revenue or
        // misrepresent a partially mapped order as a complete contents payload.
        items.length = 0;
        break;
      }
      items.push({
        productId: item.productId,
        productCode,
        ...(item.variantId ? { variantId: item.variantId } : {}),
        ...(item.sku ? { sku: item.sku } : {}),
        name: item.productName,
        quantity: item.quantity,
        unitPrice: round2(price.times(rate)),
      });
    }

    const result = validatePurchaseSnapshot({
      eventId, eventTime: Math.floor(payment.paidAt.getTime() / 1000),
      items, currency, value: round2(amount),
    });
    if (!result.valid) return reject(result.reason);
    logPurchaseDiagnostic({ eventId, source: "server", validation: "valid", status: "built" });
    return result.payload;
  } catch {
    // Invalid legacy snapshots must never make the order endpoint fail.
    return reject("invalid_snapshot");
  }
}
