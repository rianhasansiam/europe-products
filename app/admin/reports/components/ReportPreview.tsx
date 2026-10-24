"use client";
import { useLocale } from "next-intl";

import { useInterfaceTranslations } from "@/components/i18n/translate";


import { Download, FileText } from "lucide-react";

import {
  REPORT_DEFS,
  formatCurrency,
  formatDate,
  formatDateTime,
  type CategoriesReport,
  type CustomersReport,
  type InventoryReport,
  type OrdersReport,
  type ProductsReport,
  type ProfitReport,
  type ReportPayload,
  type SalesReport,
} from "@/features/admin-reports/api";
import { ButtonLoader, SectionLoader } from "@/components/ui/loading";
import { cn } from "@/lib/utils";

type Props = {
  payload: ReportPayload | null;
  isLoading: boolean;
  isDownloading: boolean;
  onDownload: () => void;
};

/**
 * On-screen preview of the generated report. The data shown here is
 * exactly what the PDF will contain — same payload, same order, same
 * formatting — so admins can sanity-check before downloading.
 */
export default function ReportPreview({
  payload,
  isLoading,
  isDownloading,
  onDownload,
}: Props) {
  const locale = useLocale();
  const i18n = useInterfaceTranslations("AdminAdminReportsComponentsReportPreview");
  if (isLoading && !payload) {
    return <SectionLoader title={i18n("Crunching the numbers")} rows={7} />;
  }

  if (!payload) {
    return (
      <div className="rounded-2xl border border-dashed border-brand-border bg-white p-10 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-light-bg text-brand-red">
          <FileText className="h-6 w-6" />
        </div>
        <h3 className="mt-3 text-base font-bold text-gray-900">
          {i18n("No report yet")}</h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
          {i18n("Pick a report type, choose a date window, and hit")}<span className="mx-1 font-semibold text-brand-red">{i18n("Generate report")}</span>
          {i18n("to preview the data here.")}</p>
      </div>
    );
  }

  const def = REPORT_DEFS[payload.meta.type];

  return (
    <section className="rounded-2xl border border-brand-border bg-white shadow-sm">
      {/* Title bar */}
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-brand-border bg-brand-light-bg px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-gray-900">{def.subject}</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            {payload.meta.allTime
              ? i18n("All time")
              : `${formatDate(payload.meta.from, locale)} → ${formatDate(payload.meta.to, locale)}`}{" "}
            {i18n("· generated")}{" "}{formatDateTime(payload.meta.generatedAt, locale)}
          </p>
        </div>

        <button
          type="button"
          onClick={onDownload}
          disabled={isDownloading}
          aria-busy={isDownloading}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-red px-4 text-sm font-semibold text-white transition hover:bg-brand-red-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isDownloading ? (
            <ButtonLoader label={i18n("Downloading...")} />
          ) : (
            <>
              <Download className="h-4 w-4" />
              {i18n("Download PDF (English)")}</>
          )}
        </button>
      </header>

      <div className="space-y-6 px-5 py-5">
        {payload.sales && <SalesPreview report={payload.sales} />}
        {payload.orders && <OrdersPreview report={payload.orders} />}
        {payload.products && <ProductsPreview report={payload.products} />}
        {payload.profit && <ProfitPreview report={payload.profit} />}
        {payload.inventory && <InventoryPreview report={payload.inventory} />}
        {payload.customers && <CustomersPreview report={payload.customers} />}
        {payload.categories && <CategoriesPreview report={payload.categories} />}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Shared building blocks                                                    */
/* -------------------------------------------------------------------------- */

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-bold uppercase tracking-wider text-brand-black">
      {children}
    </h3>
  );
}

function StatGrid({
  items,
}: {
  items: Array<{ label: string; value: string; tone?: "default" | "muted" | "danger" }>;
}) {
  const i18n = useInterfaceTranslations("AdminAdminReportsComponentsReportPreview");
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl border border-brand-border bg-brand-light-bg p-3"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            {i18n(item.label)}
          </p>
          <p
            className={cn(
              "mt-1 text-lg font-extrabold",
              item.tone === "danger"
                ? "text-rose-700"
                : item.tone === "muted"
                  ? "text-gray-700"
                  : "text-gray-900",
            )}
          >
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function DataTable({
  headers,
  rows,
  emptyLabel = "No rows in this window.",
}: {
  headers: string[];
  rows: Array<Array<string | number>>;
  emptyLabel?: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-brand-border bg-white px-3 py-4 text-center text-xs text-gray-500">
        {emptyLabel}
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-brand-border">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-brand-light-bg text-start text-[11px] uppercase tracking-wider text-brand-black">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-3 py-2 font-bold">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={idx}
                className="border-t border-brand-border align-top text-gray-700"
              >
                {row.map((cell, cellIdx) => (
                  <td key={cellIdx} className="px-3 py-2">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Per-report previews                                                       */
/* -------------------------------------------------------------------------- */

function SalesPreview({ report }: { report: SalesReport }) {
  const locale = useLocale();
  const i18n = useInterfaceTranslations("AdminAdminReportsComponentsReportPreview");
  return (
    <>
      <div>
        <SectionHeading>{i18n("Summary")}</SectionHeading>
        <div className="mt-2">
          <StatGrid
            items={[
              {
                label: "Revenue",
                value: formatCurrency(report.summary.totalRevenue, undefined, locale),
              },
              {
                label: "Orders",
                value: String(report.summary.totalOrders),
              },
              {
                label: "Avg order value",
                value: formatCurrency(report.summary.avgOrderValue, undefined, locale),
              },
              {
                label: "Discounts",
                value: formatCurrency(report.summary.totalDiscounts, undefined, locale),
                tone: "muted",
              },
              {
                label: "Delivery fees",
                value: formatCurrency(report.summary.totalDeliveryCharges, undefined, locale),
                tone: "muted",
              },
              {
                label: "Cancelled",
                value: `${report.summary.cancelledOrders} · ${formatCurrency(report.summary.cancelledRevenue, undefined, locale)}`,
                tone: "danger",
              },
            ]}
          />
        </div>
      </div>

      <div>
        <SectionHeading>{i18n("Orders by status")}</SectionHeading>
        <div className="mt-2">
          <DataTable
            headers={["Status", "Orders", "Revenue"]}
            rows={report.byStatus.map((row) => [
              row.status,
              row.orders,
              formatCurrency(row.revenue, undefined, locale),
            ])}
          />
        </div>
      </div>

      <div>
        <SectionHeading>{i18n("Payment status (live orders)")}</SectionHeading>
        <div className="mt-2">
          <DataTable
            headers={["Payment status", "Orders", "Revenue"]}
            rows={report.byPaymentStatus.map((row) => [
              row.paymentStatus,
              row.orders,
              formatCurrency(row.revenue, undefined, locale),
            ])}
          />
        </div>
      </div>

      <div>
        <SectionHeading>{i18n("Daily revenue")}</SectionHeading>
        <div className="mt-2">
          <DataTable
            headers={["Date", "Orders", "Revenue"]}
            rows={report.dailySeries.map((row) => [
              formatDate(row.day, locale),
              row.orders,
              formatCurrency(row.revenue, undefined, locale),
            ])}
          />
        </div>
      </div>

      <div>
        <SectionHeading>{i18n("Recent orders")}</SectionHeading>
        <div className="mt-2">
          <DataTable
            headers={[
              "Order #",
              "Customer",
              "Status",
              "Payment",
              "Total",
              "Placed",
            ]}
            rows={report.recentOrders.map((row) => [
              row.orderNumber,
              row.customerName,
              row.status,
              row.paymentStatus,
              formatCurrency(row.totalAmount, undefined, locale),
              formatDateTime(row.createdAt, locale),
            ])}
          />
        </div>
      </div>
    </>
  );
}

function OrdersPreview({ report }: { report: OrdersReport }) {
  const locale = useLocale();
  const i18n = useInterfaceTranslations("AdminAdminReportsComponentsReportPreview");
  return (
    <>
      <div>
        <SectionHeading>{i18n("Summary")}</SectionHeading>
        <div className="mt-2">
          <StatGrid
            items={[
              {
                label: "Orders",
                value: String(report.summary.totalOrders),
              },
              {
                label: "Total amount",
                value: formatCurrency(report.summary.totalAmount, undefined, locale),
              },
              {
                label: "Discounts applied",
                value: formatCurrency(report.summary.totalDiscounts, undefined, locale),
                tone: "muted",
              },
            ]}
          />
        </div>
      </div>

      <div>
        <SectionHeading>{i18n("By status")}</SectionHeading>
        <div className="mt-2">
          <DataTable
            headers={["Status", "Orders"]}
            rows={report.byStatus.map((row) => [row.status, row.orders])}
          />
        </div>
      </div>

      <div>
        <SectionHeading>{i18n("Order log")}</SectionHeading>
        <div className="mt-2">
          <DataTable
            headers={[
              "Order #",
              "Customer",
              "Status",
              "Pay",
              "Items",
              "Total",
              "Placed",
            ]}
            rows={report.rows.map((row) => [
              row.orderNumber,
              `${row.customerName} · ${row.customerPhone}`,
              row.status,
              row.paymentStatus,
              row.itemsCount,
              formatCurrency(row.totalAmount, undefined, locale),
              formatDateTime(row.createdAt, locale),
            ])}
          />
        </div>
      </div>
    </>
  );
}

function ProductsPreview({ report }: { report: ProductsReport }) {
  const locale = useLocale();
  const i18n = useInterfaceTranslations("AdminAdminReportsComponentsReportPreview");
  return (
    <>
      <div>
        <SectionHeading>{i18n("Summary")}</SectionHeading>
        <div className="mt-2">
          <StatGrid
            items={[
              {
                label: "Unique products",
                value: String(report.summary.uniqueProducts),
              },
              {
                label: "Units sold",
                value: String(report.summary.unitsSold),
              },
              {
                label: "Revenue",
                value: formatCurrency(report.summary.revenue, undefined, locale),
              },
            ]}
          />
        </div>
      </div>

      <div>
        <SectionHeading>{i18n("Top products by revenue")}</SectionHeading>
        <div className="mt-2">
          <DataTable
            headers={[
              "#",
              "Product",
              "Category",
              "Units",
              "Revenue",
              "Price now",
              "Stock",
              "Status",
            ]}
            rows={report.rows.map((row, idx) => [
              idx + 1,
              row.name,
              row.category,
              row.unitsSold,
              formatCurrency(row.revenue, undefined, locale),
              row.currentPrice != null ? formatCurrency(row.currentPrice, undefined, locale) : "—",
              row.currentStock != null ? String(row.currentStock) : "—",
              row.status ?? "—",
            ])}
          />
        </div>
      </div>
    </>
  );
}

function ProfitPreview({ report }: { report: ProfitReport }) {
  const locale = useLocale();
  const i18n = useInterfaceTranslations("AdminAdminReportsComponentsReportPreview");
  return (
    <>
      <div>
        <SectionHeading>{i18n("Summary")}</SectionHeading>
        <div className="mt-2">
          <StatGrid
            items={[
              {
                label: "Revenue",
                value: formatCurrency(report.summary.totalRevenue, undefined, locale),
              },
              {
                label: "Cost of goods",
                value: formatCurrency(report.summary.totalCost, undefined, locale),
                tone: "muted",
              },
              {
                label: "Gross profit",
                value: formatCurrency(report.summary.grossProfit, undefined, locale),
                tone: report.summary.grossProfit < 0 ? "danger" : "default",
              },
              {
                label: "Profit margin",
                value: `${report.summary.profitMargin}%`,
                tone: report.summary.profitMargin < 0 ? "danger" : "default",
              },
              {
                label: "Units sold",
                value: String(report.summary.unitsSold),
              },
              {
                label: "Products tracked",
                value: String(report.summary.productsTracked),
              },
            ]}
          />
        </div>
      </div>

      <div>
        <SectionHeading>{i18n("Profit by product")}</SectionHeading>
        <div className="mt-2">
          <DataTable
            headers={[
              "#",
              "Product",
              "Category",
              "Units",
              "Revenue",
              "Cost",
              "Profit",
              "Margin",
              "Stock",
              "Status",
            ]}
            rows={report.rows.map((row, idx) => [
              idx + 1,
              row.name,
              row.category,
              row.unitsSold,
              formatCurrency(row.revenue, undefined, locale),
              formatCurrency(row.cost, undefined, locale),
              formatCurrency(row.profit, undefined, locale),
              `${row.margin}%`,
              row.currentStock != null ? String(row.currentStock) : "—",
              row.status ?? "—",
            ])}
          />
        </div>
      </div>
    </>
  );
}

function InventoryPreview({ report }: { report: InventoryReport }) {
  const locale = useLocale();
  const i18n = useInterfaceTranslations("AdminAdminReportsComponentsReportPreview");
  return (
    <>
      <div>
        <SectionHeading>{i18n("Summary")}</SectionHeading>
        <div className="mt-2">
          <StatGrid
            items={[
              {
                label: "Products",
                value: String(report.summary.totalProducts),
              },
              {
                label: "Units in stock",
                value: String(report.summary.totalUnitsInStock),
              },
              {
                label: "Out of stock",
                value: String(report.summary.outOfStock),
                tone: report.summary.outOfStock > 0 ? "danger" : "default",
              },
              {
                label: "Low stock",
                value: String(report.summary.lowStock),
                tone: report.summary.lowStock > 0 ? "danger" : "default",
              },
              {
                label: "Inventory value",
                value: formatCurrency(report.summary.inventoryValue, undefined, locale),
              },
            ]}
          />
        </div>
      </div>

      <div>
        <SectionHeading>{i18n("Catalog · lowest stock first")}</SectionHeading>
        <div className="mt-2">
          <DataTable
            headers={[
              "Product",
              "Category",
              "Price",
              "Discount",
              "Stock",
              "Status",
              "Updated",
            ]}
            rows={report.rows.map((row) => [
              row.name,
              row.category,
              formatCurrency(row.price, undefined, locale),
              row.discountPrice != null ? formatCurrency(row.discountPrice, undefined, locale) : "—",
              row.stock,
              row.status,
              formatDate(row.updatedAt, locale),
            ])}
          />
        </div>
      </div>
    </>
  );
}

function CustomersPreview({ report }: { report: CustomersReport }) {
  const locale = useLocale();
  const i18n = useInterfaceTranslations("AdminAdminReportsComponentsReportPreview");
  return (
    <>
      <div>
        <SectionHeading>{i18n("Summary")}</SectionHeading>
        <div className="mt-2">
          <StatGrid
            items={[
              {
                label: "Total users",
                value: String(report.summary.totalUsers),
              },
              {
                label: "New sign-ups",
                value: String(report.summary.newSignupsInWindow),
              },
              {
                label: "Active buyers",
                value: String(report.summary.activeBuyers),
              },
              {
                label: "Revenue",
                value: formatCurrency(report.summary.totalRevenue, undefined, locale),
              },
              {
                label: "Avg per buyer",
                value: formatCurrency(report.summary.avgRevenuePerBuyer, undefined, locale),
              },
            ]}
          />
        </div>
      </div>

      <div>
        <SectionHeading>{i18n("Top customers")}</SectionHeading>
        <div className="mt-2">
          <DataTable
            headers={[
              "Customer",
              "Email",
              "Phone",
              "City",
              "Role",
              "Orders",
              "Spend",
              "Last order",
            ]}
            rows={report.rows.map((row) => [
              row.name,
              row.email ?? "—",
              row.phone ?? "—",
              row.city ?? "—",
              row.role,
              row.ordersCount,
              formatCurrency(row.totalSpend, undefined, locale),
              row.lastOrderAt ? formatDate(row.lastOrderAt, locale) : "—",
            ])}
          />
        </div>
      </div>
    </>
  );
}

function CategoriesPreview({ report }: { report: CategoriesReport }) {
  const locale = useLocale();
  const i18n = useInterfaceTranslations("AdminAdminReportsComponentsReportPreview");
  return (
    <>
      <div>
        <SectionHeading>{i18n("Summary")}</SectionHeading>
        <div className="mt-2">
          <StatGrid
            items={[
              {
                label: "Total categories",
                value: String(report.summary.totalCategories),
              },
              {
                label: "Active",
                value: String(report.summary.activeCategories),
              },
              {
                label: "Catalog products",
                value: String(report.summary.totalProducts),
              },
              {
                label: "Units sold",
                value: String(report.summary.unitsSold),
              },
              {
                label: "Revenue",
                value: formatCurrency(report.summary.revenue, undefined, locale),
              },
            ]}
          />
        </div>
      </div>

      <div>
        <SectionHeading>{i18n("Direct category performance")}</SectionHeading>
        <div className="mt-2">
          <DataTable
            headers={[
              "Category breadcrumb",
              "Canonical path",
              "Status",
              "Direct products",
              "Units",
              "Revenue",
            ]}
            rows={report.rows.map((row) => [
              row.breadcrumbLabel,
              `/${row.path}`,
              row.status,
              row.directProductCount,
              row.unitsSold,
              formatCurrency(row.revenue, undefined, locale),
            ])}
          />
        </div>
      </div>

      <div>
        <SectionHeading>{i18n("Root category rollups")}</SectionHeading>
        <p className="mt-1 text-xs text-gray-500">
          {i18n("Each descendant contributes to one root only; these rows do not duplicate intermediate-category totals.")}</p>
        <div className="mt-2">
          <DataTable
            headers={[
              "Root category",
              "Canonical path",
              "Status",
              "Categories",
              "Subtree products",
              "Units",
              "Revenue",
            ]}
            rows={report.rootRollups.map((row) => [
              row.name,
              `/${row.path}`,
              row.status,
              row.categoryCount,
              row.totalProductCount,
              row.unitsSold,
              formatCurrency(row.revenue, undefined, locale),
            ])}
          />
        </div>
      </div>
    </>
  );
}
