"use client";
import { formatMoney } from "@/lib/currency/format-money";
import { parseHistoricalCurrencyCode } from "@/lib/currency/config";
import { useLocale } from "next-intl";

import { useInterfaceTranslations } from "@/components/i18n/translate";


import Link from "@/lib/i18n/navigation";
import { ArrowRight, ShoppingBag } from "lucide-react";

import type {
  DashboardPaymentStatus,
  DashboardRecentOrder,
} from "@/features/admin-dashboard/api";
import { PAYMENT_STATUS_META } from "@/features/orders/payment";
import { ORDER_STATUS_META } from "@/lib/orders/status";
import { cn } from "@/lib/utils";

const PAYMENT_STYLES: Record<DashboardPaymentStatus, string> = {
  PAID: PAYMENT_STATUS_META.PAID.pill,
  UNPAID: PAYMENT_STATUS_META.UNPAID.pill,
  PENDING: PAYMENT_STATUS_META.PENDING.pill,
  FAILED: PAYMENT_STATUS_META.FAILED.pill,
  REFUNDED: PAYMENT_STATUS_META.REFUNDED.pill,
};

type RecentOrdersProps = {
  orders: DashboardRecentOrder[];
  loading?: boolean;
};

export default function RecentOrders({ orders, loading }: RecentOrdersProps) {
  const locale = useLocale();
  const i18n = useInterfaceTranslations("AdminAdminComponentsRecentOrders");
  return (
    <section className="overflow-hidden rounded-2xl border border-brand-border bg-white shadow-sm">
      <header className="flex items-center justify-between border-b border-brand-border px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-sm font-bold text-gray-900">{i18n("Recent Orders")}</h2>
          <p className="text-xs text-gray-500">
            {i18n("Latest activity from your store")}</p>
        </div>
        <Link
          href="/admin/orders"
          className="group inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-brand-red transition-colors duration-200 hover:bg-brand-light-bg"
        >
          {i18n("View all")}<ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      </header>

      {loading ? (
        <div className="space-y-2 p-4 sm:p-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-12 w-full animate-pulse rounded-xl bg-brand-light-bg"
            />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="grid place-items-center px-6 py-12 text-center">
          <ShoppingBag className="h-7 w-7 text-brand-text-muted" />
          <p className="mt-2 text-sm font-semibold text-gray-700">
            {i18n("No orders yet")}</p>
          <p className="mt-1 max-w-xs text-xs text-gray-500">
            {i18n("New orders will show up here as soon as customers check out.")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand-light-bg text-start">
              <tr className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2.5 sm:px-5">{i18n("Order")}</th>
                <th className="px-4 py-2.5">{i18n("Customer")}</th>
                <th className="px-4 py-2.5">{i18n("Total")}</th>
                <th className="px-4 py-2.5">{i18n("Status")}</th>
                <th className="px-4 py-2.5">{i18n("Placed")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((order) => (
                <tr
                  key={order.id}
                  className="transition-colors duration-200 hover:bg-brand-light-bg"
                >
                  <td className="px-4 py-3 sm:px-5">
                    <Link
                      href={`/admin/orders`}
                      className="font-mono text-xs font-bold text-brand-red hover:underline"
                    >
                      #{order.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-900">
                      {order.customerName}
                    </p>
                    {order.customerEmail && (
                      <p className="text-xs text-gray-500">
                        {order.customerEmail}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-800">
                    {formatMoney(order.totalAmount, parseHistoricalCurrencyCode(order.currency) ?? "BDT", { locale, currencyDisplay: "code" })}
                    <span className="ms-1 text-xs font-normal text-gray-500">
                      · {order.itemsCount}{" "}
                      {order.itemsCount === 1 ? i18n("item") : i18n("items")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span
                        className={cn(
                          "inline-flex w-fit rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset",
                          ORDER_STATUS_META[order.status].tone.ring,
                        )}
                      >
                        {i18n(ORDER_STATUS_META[order.status].label)}
                      </span>
                      <span
                        className={cn(
                          "inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-bold",
                          PAYMENT_STYLES[order.paymentStatus],
                        )}
                      >
                        {i18n(PAYMENT_STATUS_META[order.paymentStatus].label)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {formatRelative(order.createdAt, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/**
 * Compact "x ago" formatter for the placed-at column.
 *
 * Falls back to the absolute date string for anything older than a
 * week, since "12 days ago" is harder to scan than the actual date.
 */
function formatRelative(iso: string, locale = "en"): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;

  const diff = Date.now() - then;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "Just now";
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  try {
    return new Date(iso).toLocaleDateString(locale);
  } catch {
    return iso;
  }
}
