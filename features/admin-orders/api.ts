import { readApiData, readApiError } from "@/features/http/api-envelope";
import type {
  CheckoutItemInput,
  CheckoutPaymentMethod,
  CheckoutPreview,
  CheckoutPromo,
  CheckoutSummary,
  DeliveryZone,
} from "@/features/checkout/api";
import type {
  OrderDetail,
  OrderItem,
  OrderPaymentMethod,
  OrderStatusHistoryEntry,
  PaymentStatus as OrderPaymentStatus,
} from "@/features/orders/api";
import {
  ORDER_STATUSES,
  STATUS_TRANSITIONS as ORDER_STATUS_TRANSITIONS,
  type OrderStatus,
} from "@/lib/orders/status";

export type { OrderStatus } from "@/lib/orders/status";

export type PaymentStatus = OrderPaymentStatus;

export type PaymentMethod = OrderPaymentMethod;

export type AdminOrderUser = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
} | null;

export type AdminOrderRow = {
  id: string;
  orderNumber: string;
  userId: string | null;
  guestCustomerId: string | null;
  subtotal: number;
  deliveryCharge: number;
  discountAmount: number;
  totalAmount: number;
  advancePayment: number;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  requiresPaymentReview: boolean;
  paymentReviewReasons: string[];
  paymentReviewApprovalAllowed: boolean;
  paymentReviewRefundCancellationAllowed: boolean;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  customerAddress: string;
  customerCity: string | null;
  customerArea: string | null;
  customerPostalCode: string | null;
  customerNote: string | null;
  createdAt: string;
  updatedAt: string;
  itemsCount: number;
  user: AdminOrderUser;
};

/** Admin reads retain canonical BDT prices rather than customer display prices. */
export type AdminOrderItem = Omit<OrderItem, "baseUnitPrice" | "baseTotalPrice"> & {
  displayUnitPrice?: number;
  displayTotalPrice?: number;
};

export type AdminOrderDetail = Omit<
  AdminOrderRow,
  | "itemsCount"
  | "paymentReviewReasons"
  | "paymentReviewApprovalAllowed"
  | "paymentReviewRefundCancellationAllowed"
> & {
  taxAmount: number;
  promoCode: string | null;
  items: AdminOrderItem[];
  statusHistory: OrderStatusHistoryEntry[];
};

export type AdminOrderCustomerType = "GUEST" | "REGISTERED";

/** Do not infer a guest identity for older orders with no customer relation. */
export function getAdminOrderCustomerType(order: {
  userId?: string | null;
  guestCustomerId?: string | null;
}): AdminOrderCustomerType | null {
  if (order.guestCustomerId) return "GUEST";
  if (order.userId) return "REGISTERED";
  return null;
}

export type ApiMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  meta?: ApiMeta;
};

export const API_PAGE_SIZE = 100;

export const ORDER_STATUS_VALUES: readonly OrderStatus[] = ORDER_STATUSES;

export const PAYMENT_STATUS_VALUES: readonly PaymentStatus[] = [
  "PAID",
  "UNPAID",
  "PENDING",
  "FAILED",
  "REFUNDED",
];

/**
 * Allowed forward transitions per status. Re-exported from the shared
 * `@/lib/orders/status` module so the UI never offers an invalid action
 * and the API stays the source of truth on rejection.
 */
export const STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> =
  ORDER_STATUS_TRANSITIONS;

function parseUser(value: unknown): AdminOrderUser {
  if (value == null) return null;
  const record = value as Partial<NonNullable<AdminOrderUser>>;
  return {
    id: typeof record.id === "string" ? record.id : "",
    name: typeof record.name === "string" ? record.name : null,
    email: typeof record.email === "string" ? record.email : null,
    phone: typeof record.phone === "string" ? record.phone : null,
  };
}

function parseOrderStatus(value: unknown): OrderStatus {
  return (ORDER_STATUS_VALUES as readonly string[]).includes(value as string)
    ? (value as OrderStatus)
    : "PENDING";
}

function parsePaymentStatus(value: unknown): PaymentStatus {
  return (PAYMENT_STATUS_VALUES as readonly unknown[]).includes(value)
    ? (value as PaymentStatus)
    : "UNPAID";
}

function parsePaymentMethod(value: unknown): PaymentMethod {
  return (
    [
      "CASH_ON_DELIVERY",
      "SSLCOMMERZ",
      "AIRWALLEX",
      "PAYPAL",
      "ONLINE",
    ] as const
  ).includes(value as PaymentMethod)
    ? (value as PaymentMethod)
    : "CASH_ON_DELIVERY";
}

function parseRow(entry: unknown): AdminOrderRow {
  const item = (entry ?? {}) as Partial<AdminOrderRow> & {
    user?: unknown;
  };

  return {
    id: typeof item.id === "string" ? item.id : "",
    orderNumber: typeof item.orderNumber === "string" ? item.orderNumber : "",
    userId: typeof item.userId === "string" ? item.userId : null,
    guestCustomerId:
      typeof item.guestCustomerId === "string" ? item.guestCustomerId : null,
    subtotal: Number(item.subtotal ?? 0),
    deliveryCharge: Number(item.deliveryCharge ?? 0),
    discountAmount: Number(item.discountAmount ?? 0),
    totalAmount: Number(item.totalAmount ?? 0),
    advancePayment: Number(item.advancePayment ?? 0),
    status: parseOrderStatus(item.status),
    paymentMethod: parsePaymentMethod(item.paymentMethod),
    paymentStatus: parsePaymentStatus(item.paymentStatus),
    requiresPaymentReview: item.requiresPaymentReview === true,
    paymentReviewReasons: Array.isArray(item.paymentReviewReasons)
      ? item.paymentReviewReasons.filter(
          (reason): reason is string => typeof reason === "string",
        )
      : [],
    paymentReviewApprovalAllowed: item.paymentReviewApprovalAllowed === true,
    paymentReviewRefundCancellationAllowed:
      item.paymentReviewRefundCancellationAllowed === true,
    customerName: typeof item.customerName === "string" ? item.customerName : "",
    customerPhone:
      typeof item.customerPhone === "string" ? item.customerPhone : "",
    customerEmail:
      typeof item.customerEmail === "string" ? item.customerEmail : null,
    customerAddress:
      typeof item.customerAddress === "string" ? item.customerAddress : "",
    customerCity:
      typeof item.customerCity === "string" ? item.customerCity : null,
    customerArea:
      typeof item.customerArea === "string" ? item.customerArea : null,
    customerPostalCode:
      typeof item.customerPostalCode === "string" ? item.customerPostalCode : null,
    customerNote:
      typeof item.customerNote === "string" ? item.customerNote : null,
    createdAt: typeof item.createdAt === "string" ? item.createdAt : "",
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : "",
    itemsCount: Number(item.itemsCount ?? 0),
    user: parseUser(item.user),
  };
}

export function parseOrdersPayload(payload: unknown): {
  items: AdminOrderRow[];
  meta: ApiMeta | null;
} {
  const envelope = payload as ApiEnvelope<unknown>;
  if (!envelope?.success || !Array.isArray(envelope.data)) {
    throw new Error("Orders API returned an invalid response.");
  }

  return {
    items: envelope.data.map(parseRow),
    meta: envelope.meta ?? null,
  };
}

/**
 * Walk every page of `/api/admin/orders` and return the full list.
 * The admin panel is the only consumer and the payload is small enough
 * to keep in memory; we trade a few requests for fully client-side
 * filtering / search after the initial sync.
 */
export async function fetchAllAdminOrdersSnapshot(): Promise<AdminOrderRow[]> {
  let page = 1;
  let totalPages = 1;
  const merged: AdminOrderRow[] = [];

  while (page <= totalPages) {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(API_PAGE_SIZE),
    });

    const response = await fetch(`/api/admin/orders?${params.toString()}`, {
      method: "GET",
      cache: "no-store",
    });

    let payload: unknown;
    try {
      payload = (await response.json()) as unknown;
    } catch {
      throw new Error("Failed to parse orders response.");
    }

    if (!response.ok) {
      throw new Error(readApiError(payload, "Failed to load orders."));
    }

    const { items, meta } = parseOrdersPayload(payload);
    merged.push(...items);
    totalPages = meta?.totalPages ?? 1;
    page += 1;
  }

  return merged;
}

export async function patchOrderStatus(
  orderId: string,
  status: OrderStatus,
): Promise<void> {
  const response = await fetch(`/api/admin/orders/${orderId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
    cache: "no-store",
  });

  if (!response.ok) {
    let payload: unknown = null;
    try {
      payload = (await response.json()) as unknown;
    } catch {
      // ignore — fall through to fallback message
    }
    throw new Error(readApiError(payload, "Failed to update order status."));
  }
}

export async function patchPaymentStatus(
  orderId: string,
  paymentStatus: PaymentStatus,
): Promise<void> {
  const response = await fetch(
    `/api/admin/orders/${orderId}/payment-status`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentStatus }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    let payload: unknown = null;
    try {
      payload = (await response.json()) as unknown;
    } catch {
      // ignore
    }
    throw new Error(readApiError(payload, "Failed to update payment status."));
  }
}

export async function approvePaymentReview(orderId: string): Promise<void> {
  const response = await fetch(
    `/api/admin/orders/${orderId}/payment-review`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: "APPROVE" }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    let payload: unknown = null;
    try {
      payload = (await response.json()) as unknown;
    } catch {
      // ignore
    }
    throw new Error(
      readApiError(payload, "Failed to approve the payment review."),
    );
  }
}

export async function recordPaymentRefundAndCancel(
  orderId: string,
  refundReference: string,
): Promise<void> {
  const response = await fetch(
    `/api/admin/orders/${orderId}/payment-review`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decision: "REFUND_AND_CANCEL",
        refundReference,
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    let payload: unknown = null;
    try {
      payload = (await response.json()) as unknown;
    } catch {
      // ignore
    }
    throw new Error(
      readApiError(payload, "Failed to record the refund resolution."),
    );
  }
}

export function formatCurrency(value: number, locale = "en"): string {
  return `BDT ${value.toLocaleString(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDateTime(value: string, locale = "en"): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* -------------------------------------------------------------------------- */
/*  Admin order placement                                                      */
/* -------------------------------------------------------------------------- */

export type AdminOrderCustomer = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
};

export type AdminOrderDraft = {
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  customerCity: string;
  deliveryZone: DeliveryZone;
  customerPostalCode: string;
  customerNote: string;
  promoCode: string;
  paymentMethod: CheckoutPaymentMethod;
  items: Array<Required<CheckoutItemInput>>;
};

export const EMPTY_ADMIN_ORDER_DRAFT: AdminOrderDraft = {
  customerId: "",
  customerName: "",
  customerPhone: "",
  customerEmail: "",
  customerAddress: "",
  customerCity: "",
  deliveryZone: "INSIDE_DHAKA",
  customerPostalCode: "",
  customerNote: "",
  promoCode: "",
  paymentMethod: "AIRWALLEX",
  items: [],
};

export type AdminOrderRequest = Omit<
  AdminOrderDraft,
  "promoCode" | "items"
> & {
  promoCode?: string | null;
  items: CheckoutItemInput[];
};

export type AdminPlacedOrderResult = {
  order: OrderDetail;
  summary: CheckoutSummary;
  promo: CheckoutPromo;
};

type CustomerEnvelope = {
  success?: boolean;
  data?: unknown;
  meta?: { totalPages?: unknown };
};

function parseAdminOrderCustomer(value: unknown): AdminOrderCustomer | null {
  const row = value as Partial<AdminOrderCustomer> | null;
  if (!row || typeof row.id !== "string" || row.id.length === 0) return null;

  return {
    id: row.id,
    name: typeof row.name === "string" ? row.name : null,
    email: typeof row.email === "string" ? row.email : null,
    phone: typeof row.phone === "string" ? row.phone : null,
    city: typeof row.city === "string" ? row.city : null,
  };
}

/** Load all customer accounts for the admin order form. */
export async function fetchAllAdminOrderCustomers(): Promise<
  AdminOrderCustomer[]
> {
  let page = 1;
  let totalPages = 1;
  const customers: AdminOrderCustomer[] = [];

  while (page <= totalPages) {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(API_PAGE_SIZE),
      role: "USER",
    });
    const response = await fetch(`/api/admin/users?${params.toString()}`, {
      method: "GET",
      cache: "no-store",
    });

    let payload: unknown;
    try {
      payload = (await response.json()) as unknown;
    } catch {
      throw new Error("Failed to parse customers response.");
    }
    if (!response.ok) {
      throw new Error(readApiError(payload, "Failed to load customers."));
    }

    const envelope = payload as CustomerEnvelope;
    if (!envelope.success || !Array.isArray(envelope.data)) {
      throw new Error("Customers API returned an invalid response.");
    }

    customers.push(
      ...envelope.data
        .map(parseAdminOrderCustomer)
        .filter((customer): customer is AdminOrderCustomer => customer !== null),
    );
    const reportedPages = Number(envelope.meta?.totalPages ?? 1);
    totalPages = Number.isInteger(reportedPages) && reportedPages > 0
      ? reportedPages
      : 1;
    page += 1;
  }

  return customers;
}

export async function previewAdminOrder(
  body: Pick<AdminOrderRequest, "items" | "deliveryZone" | "promoCode">,
): Promise<CheckoutPreview> {
  const response = await fetch("/api/admin/orders/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  return readApiData<CheckoutPreview>(
    response,
    "Failed to calculate the order total.",
  );
}

export async function placeAdminOrder(
  body: AdminOrderRequest,
): Promise<AdminPlacedOrderResult> {
  const response = await fetch("/api/admin/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  return readApiData<AdminPlacedOrderResult>(
    response,
    "Failed to place the order.",
  );
}

export async function fetchAdminOrderDetail(
  orderId: string,
  signal?: AbortSignal,
): Promise<AdminOrderDetail> {
  const response = await fetch(`/api/admin/orders/${orderId}`, {
    method: "GET",
    cache: "no-store",
    signal,
  });

  return readApiData<AdminOrderDetail>(response, "Failed to load order details.");
}
