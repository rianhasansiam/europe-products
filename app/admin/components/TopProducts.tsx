"use client";
import { BASE_CURRENCY } from "@/lib/currency/config";
import { useLocale } from "next-intl";

import { useInterfaceTranslations } from "@/components/i18n/translate";


import Link from "@/lib/i18n/navigation";
import { ArrowRight, Package } from "lucide-react";

import type { DashboardTopProduct } from "@/features/admin-dashboard/api";
import { cn } from "@/lib/utils";

type TopProductsProps = {
  products: DashboardTopProduct[];
  loading?: boolean;
};

export default function TopProducts({ products, loading }: TopProductsProps) {
  const locale = useLocale();
  const i18n = useInterfaceTranslations("AdminAdminComponentsTopProducts");
  const maxSales =
    products.length === 0
      ? 1
      : products.reduce((max, p) => (p.sales > max ? p.sales : max), 1);

  return (
    <section className="rounded-2xl border border-brand-border bg-white p-4 shadow-sm sm:p-5">
      <header className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-brand-red" />
          <h2 className="text-sm font-bold text-gray-900">{i18n("Top Products")}</h2>
          <span className="text-[11px] font-medium text-gray-500">
            {i18n("· last 30 days")}</span>
        </div>
        <Link
          href="/admin/products"
          className="group inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-brand-red transition-colors duration-200 hover:bg-brand-light-bg"
        >
          {i18n("View all")}<ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      </header>

      {loading ? (
        <ul className="space-y-3.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-1 items-start gap-3">
                  <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-brand-light-bg" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 w-3/5 animate-pulse rounded bg-brand-light-bg" />
                    <div className="h-2.5 w-2/5 animate-pulse rounded bg-brand-light-bg" />
                  </div>
                </div>
                <div className="h-3 w-16 animate-pulse rounded bg-brand-light-bg" />
              </div>
              <div className="h-1.5 w-full animate-pulse rounded-full bg-brand-light-bg" />
            </li>
          ))}
        </ul>
      ) : products.length === 0 ? (
        <div className="grid place-items-center rounded-xl bg-brand-light-bg px-4 py-10 text-center">
          <Package className="h-7 w-7 text-brand-text-muted" />
          <p className="mt-2 text-sm font-semibold text-gray-700">
            {i18n("No sales yet")}</p>
          <p className="mt-1 text-xs text-gray-500">
            {i18n("Top products will appear here as soon as orders come in.")}</p>
        </div>
      ) : (
        <ul className="space-y-3.5">
          {products.map((product, idx) => {
            const pct = Math.max(
              4,
              Math.round((product.sales / maxSales) * 100),
            );
            const outOfStock = product.stock === 0;
            const lowStock = product.stock > 0 && product.stock < 10;

            return (
              <li key={product.id} className="group">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-red text-xs font-extrabold text-white shadow-sm">
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">
                        {product.name}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {product.category} · {product.unitsSold} {i18n("sold")}</p>
                    </div>
                  </div>
                  <div className="text-end">
                    <p className="text-sm font-bold text-gray-900">
                      {BASE_CURRENCY} {Math.round(product.sales).toLocaleString(locale)}
                    </p>
                    <p
                      className={cn(
                        "text-[11px] font-semibold",
                        outOfStock
                          ? "text-rose-600"
                          : lowStock
                            ? "text-amber-600"
                            : "text-emerald-600",
                      )}
                    >
                      {outOfStock
                        ? i18n("Out of stock")
                        : `${product.stock} in stock`}
                    </p>
                  </div>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-brand-light-bg">
                  <div
                    className="h-full rounded-full bg-brand-red transition-all duration-500 group-hover:bg-brand-red-hover"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
