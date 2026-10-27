import { BASE_CURRENCY } from "@/lib/currency/config";
import { readApiError } from "@/features/http/api-envelope";
import type {
  OrderPaymentMethod,
  PaymentStatus as OrderPaymentStatus,
} from "@/features/orders/api";
import type { OrderStatus } from "@/lib/orders/status";

/**
 * Client-side helpers for the admin Reports page.
 *
 * The shapes here mirror the server payload from
 * `lib/services/report.service.ts`. We keep them duplicated rather
 * than importing from the service module because the service imports
 * `server-only` (and pulls in Prisma), which can't be bundled into
 * the browser.
 */

export const REPORT_TYPES = ["sales"] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export type { OrderStatus } from "@/lib/orders/status";

export type PaymentStatus = OrderPaymentStatus;
export type PaymentMethod = OrderPaymentMethod;

export type ReportMeta = {
  currency: string;
  type: ReportType;
  from: string;
  to: string;
  generatedAt: string;
  limit: number;
  allTime: boolean;
};

export type SalesReport = {
  summary: {
    totalSales: number;
    totalOrders: number;
    cancelledOrders: number;
    ordersInWindow: number;
  };
  byStatus: Array<{ status: OrderStatus; orders: number; sales: number }>;
  byPaymentStatus: Array<{
    paymentStatus: PaymentStatus;
    orders: number;
    sales: number;
  }>;
  dailySeries: Array<{ day: string; sales: number; orders: number }>;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    customerName: string;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    paymentMethod: PaymentMethod;
    totalAmount: number;
    createdAt: string;
  }>;
};

export type ReportPayload = {
  meta: ReportMeta;
  sales: SalesReport;
};

export const REPORT_DEFS: Record<
  ReportType,
  { label: string; description: string; subject: string }
> = {
  sales: {
    label: "Sales overview",
    description: "Sales totals, order counts, payment status, and daily sales.",
    subject: "Sales Overview",
  },
};

export type FetchArgs = {
  type: ReportType;
  from?: string;
  to?: string;
  limit?: number;
  allTime?: boolean;
};

export async function fetchReport(args: FetchArgs): Promise<ReportPayload> {
  const params = new URLSearchParams({ type: args.type });
  if (args.allTime) {
    params.set("allTime", "true");
  } else {
    if (args.from) params.set("from", args.from);
    if (args.to) params.set("to", args.to);
  }
  if (args.limit) params.set("limit", String(args.limit));

  const response = await fetch(`/api/admin/reports?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
  });

  let payload: unknown = null;
  try {
    payload = (await response.json()) as unknown;
  } catch {
    throw new Error("Failed to parse report response.");
  }

  if (!response.ok) {
    throw new Error(readApiError(payload, "Failed to generate report."));
  }

  const envelope = payload as { success: boolean; data: ReportPayload };
  if (!envelope?.success || !envelope.data) {
    throw new Error("Reports API returned an invalid response.");
  }

  return envelope.data;
}

/* -------------------------------------------------------------------------- */
/*  Formatting helpers                                                        */
/* -------------------------------------------------------------------------- */

export function formatCurrency(value: number, currency: string = BASE_CURRENCY, locale = "en"): string {
  const safe = Number.isFinite(value) ? value : 0;
  // Round to 2dp first to dodge floating-point noise (e.g. 2579.1000001),
  // then only show decimals when they carry information.
  const rounded = Math.round((safe + Number.EPSILON) * 100) / 100;
  const hasFraction = Math.abs(rounded % 1) > 0.0001;
  return `${currency} ${rounded.toLocaleString(locale, {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

export function formatNumber(value: number, locale = "en"): string {
  return value.toLocaleString(locale);
}

export function formatDate(value: string, locale = "en"): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
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
