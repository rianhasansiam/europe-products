import { readApiData } from "@/features/http/api-envelope";
import type { PaymentStatus } from "@/features/orders/api";
import type { OrderStatus } from "@/lib/orders/status";

/**
 * Client-side types and fetcher for the admin dashboard.
 *
 * Mirrors the payload returned by `/api/admin/dashboard`. Kept in its
 * own feature module so the page and its sub-components can import
 * the shapes without pulling in server-only code.
 */

export type DashboardTrend = "up" | "down" | "flat";

export type DashboardStat = {
  current: number;
  previous: number;
  delta: number;
  trend: DashboardTrend;
};

export type DashboardStats = {
  revenue: DashboardStat;
  profit: DashboardStat;
  orders: DashboardStat;
  customers: DashboardStat;
  cancellations: DashboardStat;
};

export type DashboardSalesPoint = {
  date: string;
  label: string;
  revenue: number;
  orders: number;
};

export type DashboardSalesSeries = {
  days: number;
  points: DashboardSalesPoint[];
  totalRevenue: number;
  totalOrders: number;
};

export type DashboardOrderStatus = OrderStatus;

export type DashboardPaymentStatus = PaymentStatus;

export type DashboardRecentOrder = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string | null;
  totalAmount: number;
  currency: string;
  itemsCount: number;
  status: DashboardOrderStatus;
  paymentStatus: DashboardPaymentStatus;
  createdAt: string;
};

export type DashboardTopProduct = {
  id: string;
  name: string;
  category: string;
  unitsSold: number;
  revenue: number;
  stock: number;
  status: "ACTIVE" | "INACTIVE";
};

export type DashboardActivityKind =
  | "order"
  | "user"
  | "product"
  | "category"
  | "banner"
  | "message"
  | "review"
  | "testimonial"
  | "settings"
  | "capital"
  | "cost"
  | "courier";

export type DashboardActivity = {
  id: string;
  kind: DashboardActivityKind;
  actor: string;
  action: string;
  target: string | null;
  performedBy: string | null;
  href: string | null;
  at: string;
};

export type DashboardOverview = {
  generatedAt: string;
  stats: DashboardStats;
  sales: DashboardSalesSeries;
  recentOrders: DashboardRecentOrder[];
  topProducts: DashboardTopProduct[];
  activity: DashboardActivity[];
};

export async function fetchDashboardOverview(): Promise<DashboardOverview> {
  const response = await fetch("/api/admin/dashboard", {
    method: "GET",
    cache: "no-store",
  });
  return readApiData<DashboardOverview>(
    response,
    "Failed to load dashboard data.",
  );
}
