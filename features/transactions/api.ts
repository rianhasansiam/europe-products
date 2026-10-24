import { readApiError } from "@/features/http/api-envelope";
import { BASE_CURRENCY, parseCurrencyCode } from "@/lib/currency/config";
import { formatMoney } from "@/lib/currency/format-money";
import {
  PAYMENT_TRANSACTION_STATUSES,
  type PaymentTransactionStatus,
} from "@/lib/payments/core/transaction-status";

export const TRANSACTION_STATUS_VALUES = PAYMENT_TRANSACTION_STATUSES;

export type TransactionStatus = PaymentTransactionStatus;

type TransactionStatusMeta = { label: string; pill: string };

export const TRANSACTION_STATUS_META: Record<
  TransactionStatus,
  TransactionStatusMeta
> = {
  PENDING: {
    label: "Pending",
    pill: "bg-amber-100 text-amber-800 ring-amber-200",
  },
  SUCCESS: {
    label: "Successful",
    pill: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  },
  FAILED: {
    label: "Failed",
    pill: "bg-rose-100 text-rose-800 ring-rose-200",
  },
  CANCELLED: {
    label: "Cancelled",
    pill: "bg-gray-100 text-gray-700 ring-gray-200",
  },
  REFUNDED: {
    label: "Refunded",
    pill: "bg-violet-100 text-violet-800 ring-violet-200",
  },
  EXPIRED: {
    label: "Expired",
    pill: "bg-orange-100 text-orange-800 ring-orange-200",
  },
  CREATED: {
    label: "Created",
    pill: "bg-sky-100 text-sky-800 ring-sky-200",
  },
  REQUIRES_PAYMENT_METHOD: {
    label: "Payment method required",
    pill: "bg-amber-100 text-amber-800 ring-amber-200",
  },
  PENDING_REVIEW: {
    label: "Pending review",
    pill: "bg-amber-100 text-amber-800 ring-amber-200",
  },
  PROCESSING: {
    label: "Processing",
    pill: "bg-blue-100 text-blue-800 ring-blue-200",
  },
  REQUIRES_REVIEW: {
    label: "Review required",
    pill: "bg-orange-100 text-orange-800 ring-orange-200",
  },
};

const UNKNOWN_TRANSACTION_STATUS_META: TransactionStatusMeta = {
  label: "Unknown",
  pill: "bg-gray-100 text-gray-700 ring-gray-200",
};

export function getTransactionStatusMeta(status: unknown): TransactionStatusMeta {
  if (
    typeof status === "string" &&
    Object.hasOwn(TRANSACTION_STATUS_META, status)
  ) {
    return TRANSACTION_STATUS_META[status as TransactionStatus];
  }
  return UNKNOWN_TRANSACTION_STATUS_META;
}

export type TransactionOrder = {
  id: string;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
};

export type CustomerTransaction = {
  id: string;
  provider: string;
  transactionId: string | null;
  bankTransactionId: string | null;
  cardType: string | null;
  amount: number;
  currency: string;
  status: TransactionStatus;
  paidAt: string | null;
  requiresReview: boolean;
  createdAt: string;
  updatedAt: string;
  order: TransactionOrder;
};

export type AdminTransaction = Omit<CustomerTransaction, "order"> & {
  riskLevel: number | null;
  reviewReason: string | null;
  reviewResolvedAt: string | null;
  reviewResolvedBy: string | null;
  reviewResolution: string | null;
  reviewResolutionReference: string | null;
  order: TransactionOrder & {
    customerName: string;
    customerEmail: string | null;
    customerPhone: string;
    user: {
      id: string;
      name: string | null;
      email: string | null;
    } | null;
  };
};

export type TransactionPageMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type CustomerTransactionQuery = {
  page?: number;
  pageSize?: number;
  status?: TransactionStatus;
  provider?: string;
};

export type AdminTransactionQuery = CustomerTransactionQuery & {
  search?: string;
  review?: "OPEN" | "RESOLVED";
};

type TransactionPage<T> = {
  items: T[];
  meta: TransactionPageMeta;
};

function transactionSearchParams(
  query: AdminTransactionQuery,
): URLSearchParams {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.status) params.set("status", query.status);
  if (query.provider?.trim()) {
    params.set("provider", query.provider.trim().toUpperCase());
  }
  if (query.search?.trim()) params.set("search", query.search.trim());
  if (query.review) params.set("review", query.review);
  return params;
}

async function fetchTransactionPage<T>(
  pathname: string,
  query: AdminTransactionQuery,
  fallbackError: string,
): Promise<TransactionPage<T>> {
  const params = transactionSearchParams(query);
  const queryString = params.toString();
  const response = await fetch(
    `${pathname}${queryString ? `?${queryString}` : ""}`,
    { method: "GET", cache: "no-store" },
  );

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(fallbackError);
  }

  const envelope = payload as {
    success?: boolean;
    data?: unknown;
    meta?: Partial<TransactionPageMeta>;
  };
  if (!response.ok || !envelope.success || !Array.isArray(envelope.data)) {
    throw new Error(readApiError(payload, fallbackError));
  }

  const items = envelope.data as T[];
  return {
    items,
    meta: {
      page: envelope.meta?.page ?? query.page ?? 1,
      pageSize: envelope.meta?.pageSize ?? query.pageSize ?? items.length,
      total: envelope.meta?.total ?? items.length,
      totalPages: envelope.meta?.totalPages ?? 1,
    },
  };
}

export function fetchMyTransactions(
  query: CustomerTransactionQuery = {},
): Promise<TransactionPage<CustomerTransaction>> {
  return fetchTransactionPage<CustomerTransaction>(
    "/api/transactions",
    query,
    "Failed to load your transaction history.",
  );
}

export function fetchAdminTransactions(
  query: AdminTransactionQuery = {},
): Promise<TransactionPage<AdminTransaction>> {
  return fetchTransactionPage<AdminTransaction>(
    "/api/admin/transactions",
    query,
    "Failed to load transaction history.",
  );
}

export function formatTransactionAmount(
  amount: number,
  currency: string,
  locale = "en",
): string {
  const normalizedCurrency = currency.trim().toUpperCase() || BASE_CURRENCY;
  const supportedCurrency = parseCurrencyCode(normalizedCurrency);
  if (supportedCurrency) return formatMoney(amount, supportedCurrency, { locale });

  // Transactions record the payment provider's actual currency, which is
  // independent from the storefront display-currency allowlist.
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: normalizedCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${normalizedCurrency} ${new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)}`;
  }
}

export function formatTransactionDate(value: string | null, locale = "en"): string {
  if (!value) return "—";
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

export function paymentProviderLabel(provider: string): string {
  switch (provider.toUpperCase()) {
    case "SSLCOMMERZ":
      return "SSLCommerz";
    case "AIRWALLEX":
      return "Airwallex";
    case "CASH_ON_DELIVERY":
      return "Cash on delivery";
    case "ADMIN_ADVANCE":
      return "Admin advance";
    case "ONLINE":
      return "Online payment";
    case "PAYPAL":
      return "PayPal";
    default:
      return provider.replaceAll("_", " ");
  }
}
