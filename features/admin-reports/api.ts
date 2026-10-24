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

export const REPORT_TYPES = [
  "sales",
  "orders",
  "products",
  "profit",
  "inventory",
  "customers",
  "categories",
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export type { OrderStatus } from "@/lib/orders/status";

export type PaymentStatus = OrderPaymentStatus;
export type PaymentMethod = OrderPaymentMethod;

export type ReportMeta = {
  type: ReportType;
  from: string;
  to: string;
  generatedAt: string;
  limit: number;
  allTime: boolean;
};

export type SalesReport = {
  summary: {
    totalRevenue: number;
    totalOrders: number;
    avgOrderValue: number;
    grossSubtotal: number;
    totalDeliveryCharges: number;
    totalDiscounts: number;
    cancelledRevenue: number;
    cancelledOrders: number;
    ordersInWindow: number;
  };
  byStatus: Array<{ status: OrderStatus; orders: number; revenue: number }>;
  byPaymentStatus: Array<{
    paymentStatus: PaymentStatus;
    orders: number;
    revenue: number;
  }>;
  dailySeries: Array<{ day: string; revenue: number; orders: number }>;
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

export type OrdersReport = {
  summary: {
    totalOrders: number;
    totalAmount: number;
    totalDiscounts: number;
  };
  byStatus: Array<{ status: OrderStatus; orders: number }>;
  rows: Array<{
    id: string;
    orderNumber: string;
    customerName: string;
    customerPhone: string;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    paymentMethod: PaymentMethod;
    itemsCount: number;
    subtotal: number;
    deliveryCharge: number;
    discountAmount: number;
    totalAmount: number;
    createdAt: string;
  }>;
};

export type ProductsReport = {
  summary: { uniqueProducts: number; unitsSold: number; revenue: number };
  rows: Array<{
    productId: string;
    name: string;
    category: string;
    categoryPath: string | null;
    unitsSold: number;
    revenue: number;
    currentPrice: number | null;
    currentStock: number | null;
    status: "ACTIVE" | "INACTIVE" | null;
  }>;
};

export type ProfitReport = {
  summary: {
    totalRevenue: number;
    totalCost: number;
    grossProfit: number;
    profitMargin: number;
    unitsSold: number;
    productsTracked: number;
  };
  rows: Array<{
    productId: string;
    name: string;
    category: string;
    categoryPath: string | null;
    unitsSold: number;
    revenue: number;
    cost: number;
    profit: number;
    margin: number;
    currentStock: number | null;
    status: "ACTIVE" | "INACTIVE" | null;
  }>;
};

export type InventoryReport = {
  summary: {
    totalProducts: number;
    totalUnitsInStock: number;
    outOfStock: number;
    lowStock: number;
    inventoryValue: number;
  };
  rows: Array<{
    id: string;
    name: string;
    category: string;
    categoryPath: string;
    price: number;
    discountPrice: number | null;
    stock: number;
    status: "ACTIVE" | "INACTIVE";
    updatedAt: string;
  }>;
};

export type CustomersReport = {
  summary: {
    totalUsers: number;
    newSignupsInWindow: number;
    activeBuyers: number;
    totalRevenue: number;
    avgRevenuePerBuyer: number;
  };
  rows: Array<{
    userId: string;
    name: string;
    email: string | null;
    phone: string | null;
    city: string | null;
    role: "USER" | "ADMIN";
    ordersCount: number;
    totalSpend: number;
    lastOrderAt: string | null;
  }>;
};

export type CategoriesReport = {
  summary: {
    totalCategories: number;
    activeCategories: number;
    totalProducts: number;
    unitsSold: number;
    revenue: number;
  };
  rows: Array<{
    categoryId: string;
    name: string;
    breadcrumbLabel: string;
    path: string;
    depth: number;
    status: "ACTIVE" | "INACTIVE";
    directProductCount: number;
    /** Compatibility alias for older report payloads. */
    productCount: number;
    unitsSold: number;
    revenue: number;
  }>;
  rootRollups: Array<{
    categoryId: string;
    name: string;
    path: string;
    status: "ACTIVE" | "INACTIVE";
    categoryCount: number;
    totalProductCount: number;
    unitsSold: number;
    revenue: number;
  }>;
};

export type ReportPayload = {
  meta: ReportMeta;
  sales?: SalesReport;
  orders?: OrdersReport;
  products?: ProductsReport;
  profit?: ProfitReport;
  inventory?: InventoryReport;
  customers?: CustomersReport;
  categories?: CategoriesReport;
};

/**
 * Human-readable definitions of the available report types. Used to
 * render the picker cards on the Reports page and the title block on
 * the generated PDF.
 */
export const REPORT_DEFS: Record<
  ReportType,
  { label: string; description: string; subject: string }
> = {
  sales: {
    label: "Sales overview",
    description:
      "Revenue, average order value, payment status split, and daily sales trend.",
    subject: "Sales Overview",
  },
  orders: {
    label: "Orders log",
    description:
      "Every order placed in the window with line counts and totals.",
    subject: "Orders Log",
  },
  products: {
    label: "Top products",
    description:
      "Best-selling products ranked by revenue and units shipped.",
    subject: "Top Products",
  },
  profit: {
    label: "Profit report",
    description:
      "Gross profit and margin per product — revenue against buying cost for sold items.",
    subject: "Profit Report",
  },
  inventory: {
    label: "Inventory snapshot",
    description:
      "Current stock levels, low/out-of-stock items, and total inventory value.",
    subject: "Inventory Snapshot",
  },
  customers: {
    label: "Customers",
    description:
      "Top spenders, new sign-ups, and active buyers in the window.",
    subject: "Customers",
  },
  categories: {
    label: "Categories",
    description:
      "Direct category performance with separate, non-duplicating root rollups.",
    subject: "Category Performance",
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
