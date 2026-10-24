import { readApiData } from "@/features/http/api-envelope";
import {
  type CurrencyCode,
} from "@/lib/currency/config";
import type { OrderStatus } from "@/lib/orders/status";
import type { VerifiedPurchaseSnapshot } from "@/lib/analytics/order-purchase";

/**
 * Client-side types and fetchers for order detail / summary screens.
 *
 * Mirrors the shape returned by `/api/orders/[id]` (and the `order`
 * field of `/api/checkout`'s response). Kept in its own feature file
 * so both the checkout flow and the post-checkout summary page can
 * import it without circular dependencies.
 */

export type { OrderStatus } from "@/lib/orders/status";

export type PaymentStatus =
  | "PAID"
  | "UNPAID"
  | "PENDING"
  | "FAILED"
  | "REFUNDED";

export type OrderPaymentMethod =
  | "CASH_ON_DELIVERY"
  | "SSLCOMMERZ"
  | "AIRWALLEX"
  | "PAYPAL"
  | "ONLINE";

/** One entry in an order's status audit trail / tracking timeline. */
export type OrderStatusHistoryEntry = {
  id: string;
  status: OrderStatus;
  note: string | null;
  updatedBy: string | null;
  createdAt: string;
};

export type OrderItem = {
  id: string;
  productId: string | null;
  variantId: string | null;
  productName: string;
  productImage: string | null;
  sku: string | null;
  variantName: string | null;
  color: string | null;
  size: string | null;
  variantAttributes: Record<string, string> | null;
  attributeSummary: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  baseUnitPrice: number;
  baseTotalPrice: number;
  // Live product link for navigation; null if the product was deleted.
  product: {
    id: string;
    name: string;
    slug: string;
  } | null;
};

export type OrderDetail = {
  id: string;
  orderNumber: string;
  userId: string | null;
  guestCustomerId: string | null;

  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  customerAddress: string;
  customerCity: string | null;
  customerPostalCode: string | null;
  customerNote: string | null;

  subtotal: number;
  deliveryCharge: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  advancePayment: number;
  currency: CurrencyCode;
  baseCurrency: CurrencyCode;
  paymentAmount: number | null;
  paymentCurrency: CurrencyCode;
  baseSubtotal: number;
  baseDeliveryCharge: number;
  baseDiscountAmount: number;
  baseTaxAmount: number;
  baseTotalAmount: number;
  baseAdvancePayment: number;
  exchangeRate: string;
  exchangeRateTimestamp: string | null;
  promoCode: string | null;

  status: OrderStatus;
  paymentMethod: OrderPaymentMethod;
  paymentStatus: PaymentStatus;
  requiresPaymentReview: boolean;
  metaPurchase?: VerifiedPurchaseSnapshot | null;

  createdAt: string;
  updatedAt: string;

  items: OrderItem[];
  // Full status timeline, oldest first. Powers the order tracker.
  statusHistory: OrderStatusHistoryEntry[];
};

/**
 * Fetch a single order. `/api/orders/[id]` enforces account ownership or
 * the narrowly scoped HttpOnly cookie issued for a guest's own order.
 */
export async function fetchOrderDetail(orderId: string): Promise<OrderDetail> {
  const response = await fetch(`/api/orders/${orderId}`, {
    method: "GET",
    cache: "no-store",
  });

  return readApiData<OrderDetail>(response, "Failed to load order details.");
}

/* -------------------------------------------------------------------------- */
/*  My orders (history)                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Compact summary of an order returned by `GET /api/orders/my-orders`.
 * Smaller than `OrderDetail` because the listing page doesn't need the
 * full per-line product image — just enough to render a card.
 */
export type MyOrderSummary = {
  id: string;
  orderNumber: string;
  totalAmount: number;
  advancePayment: number;
  currency: CurrencyCode;
  baseCurrency: CurrencyCode;
  paymentAmount: number | null;
  paymentCurrency: CurrencyCode;
  baseTotalAmount: number;
  baseAdvancePayment: number;
  exchangeRate: string;
  exchangeRateTimestamp: string | null;
  status: OrderStatus;
  paymentMethod: OrderPaymentMethod;
  paymentStatus: PaymentStatus;
  requiresPaymentReview: boolean;
  createdAt: string;
  updatedAt: string;
  items: Array<{
    id: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    baseUnitPrice: number;
    baseTotalPrice: number;
    productId: string | null;
    variantId: string | null;
    productName: string;
    productImage: string | null;
    sku: string | null;
    variantName: string | null;
    color: string | null;
    size: string | null;
    variantAttributes: Record<string, string> | null;
    attributeSummary: string | null;
    product: {
      id: string;
      name: string;
      slug: string;
    } | null;
  }>;
};

export type MyOrdersPage = {
  items: MyOrderSummary[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type MyOrdersQuery = {
  page?: number;
  pageSize?: number;
  status?: OrderStatus;
};

export async function fetchMyOrders(query: MyOrdersQuery = {}): Promise<MyOrdersPage> {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.status) params.set("status", query.status);

  const qs = params.toString();
  const url = `/api/orders/my-orders${qs ? `?${qs}` : ""}`;

  const response = await fetch(url, { method: "GET", cache: "no-store" });

  // The listing endpoint emits `{ success, data: items[], meta }` so
  // we pull the `meta` envelope manually here. `readApiData` would
  // throw away `meta` since it returns `data` only.
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("Failed to load your orders.");
  }

  type Envelope = {
    success?: boolean;
    data?: MyOrderSummary[];
    meta?: MyOrdersPage["meta"];
    error?: string;
    message?: string;
  };
  const envelope = payload as Envelope;

  if (!response.ok || !envelope?.success) {
    throw new Error(
      envelope?.message ?? envelope?.error ?? "Failed to load your orders.",
    );
  }

  return {
    items: envelope.data ?? [],
    meta: envelope.meta ?? {
      page: 1,
      pageSize: envelope.data?.length ?? 0,
      total: envelope.data?.length ?? 0,
      totalPages: 1,
    },
  };
}

export async function cancelMyOrder(orderId: string): Promise<OrderDetail> {
  const response = await fetch(`/api/orders/${orderId}/cancel`, {
    method: "PATCH",
    cache: "no-store",
  });
  return readApiData<OrderDetail>(response, "Failed to cancel order.");
}
