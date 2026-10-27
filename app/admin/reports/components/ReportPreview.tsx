"use client";
import { useLocale } from "next-intl";

import { useInterfaceTranslations } from "@/components/i18n/translate";


import { Download, FileText } from "lucide-react";

import {
  REPORT_DEFS,
  formatCurrency,
  formatDate,
  formatDateTime,
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
          {i18n("Choose a date window and hit")}<span className="mx-1 font-semibold text-brand-red">{i18n("Generate report")}</span>
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
          <h2 className="text-base font-bold text-gray-900">{i18n(def.subject)}</h2>
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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">
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
  const i18n = useInterfaceTranslations("AdminAdminReportsComponentsReportPreview");
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-brand-border bg-white px-3 py-4 text-center text-xs text-gray-500">
        {i18n(emptyLabel)}
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
                  {i18n(header)}
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
                label: "Sales",
                value: formatCurrency(report.summary.totalSales, undefined, locale),
              },
              {
                label: "Orders",
                value: String(report.summary.totalOrders),
              },
              {
                label: "Cancelled",
                value: String(report.summary.cancelledOrders),
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
            headers={["Status", "Orders", "Sales"]}
            rows={report.byStatus.map((row) => [
              row.status,
              row.orders,
              formatCurrency(row.sales, undefined, locale),
            ])}
          />
        </div>
      </div>

      <div>
        <SectionHeading>{i18n("Payment status (live orders)")}</SectionHeading>
        <div className="mt-2">
          <DataTable
            headers={["Payment status", "Orders", "Sales"]}
            rows={report.byPaymentStatus.map((row) => [
              row.paymentStatus,
              row.orders,
              formatCurrency(row.sales, undefined, locale),
            ])}
          />
        </div>
      </div>

      <div>
        <SectionHeading>{i18n("Daily sales")}</SectionHeading>
        <div className="mt-2">
          <DataTable
            headers={["Date", "Orders", "Sales"]}
            rows={report.dailySeries.map((row) => [
              formatDate(row.day, locale),
              row.orders,
              formatCurrency(row.sales, undefined, locale),
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
