"use client";
import { useLocale } from "next-intl";

import { useInterfaceTranslations } from "@/components/i18n/translate";


import Image from "next/image";
import { PackageCheck, PackageX, Truck } from "lucide-react";

import {
  formatPercent,
  humanise,
  riskLabelFromRate,
  riskToneFromRate,
  type CourierReport,
  type RiskTone,
} from "@/features/admin-courier/api";
import { cn } from "@/lib/utils";

const TONE_BADGE: Record<RiskTone, string> = {
  good: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warn: "bg-amber-50 text-amber-700 ring-amber-200",
  bad: "bg-rose-50 text-rose-700 ring-rose-200",
  neutral: "bg-gray-50 text-gray-600 ring-gray-200",
};

const TONE_BAR: Record<RiskTone, string> = {
  good: "bg-emerald-500",
  warn: "bg-amber-500",
  bad: "bg-rose-500",
  neutral: "bg-gray-300",
};

export default function CourierReportPanel({
  report,
}: {
  report: CourierReport;
}) {
  const locale = useLocale();
  const i18n = useInterfaceTranslations("AdminAdminCourierComponentsCourierReportPanel");
  const { totals } = report;
  const tone = riskToneFromRate(totals.successRate, totals.total);

  return (
    <div className="space-y-4">
      {/* Overall summary */}
      <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {i18n("Courier history for")}</p>
            <p className="text-lg font-bold text-gray-900">{report.phone}</p>
          </div>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset",
              TONE_BADGE[tone],
            )}
          >
            {riskLabelFromRate(totals.successRate, totals.total)}
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <Stat label={i18n("Total parcels")} value={totals.total.toLocaleString(locale)} />
          <Stat
            label={i18n("Delivered")}
            value={totals.success.toLocaleString(locale)}
            tone="good"
          />
          <Stat
            label={i18n("Cancelled")}
            value={totals.cancel.toLocaleString(locale)}
            tone="bad"
          />
          <Stat
            label={i18n("Success rate")}
            value={formatPercent(totals.successRate, locale)}
            tone={tone === "neutral" ? "neutral" : tone}
          />
        </div>

        {totals.total > 0 && (
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs text-gray-500">
              <span>{i18n("Delivered")}{" "}{formatPercent(totals.successRate, locale)}</span>
              <span>{i18n("Cancelled")}{" "}{formatPercent(totals.cancelRate, locale)}</span>
            </div>
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="bg-emerald-500"
                style={{ width: `${Math.min(100, totals.successRate)}%` }}
              />
              <div
                className="bg-rose-500"
                style={{ width: `${Math.min(100, totals.cancelRate)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Per-courier breakdown */}
      {report.couriers.length === 0 ? (
        <div className="rounded-2xl border border-brand-border bg-white p-6 text-center text-sm text-gray-600 shadow-sm">
          {i18n("No courier-level breakdown is available for this number.")}</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {report.couriers.map((courier) => {
            const courierTone = riskToneFromRate(
              courier.successRate,
              courier.total,
            );
            const rating = humanise(courier.customerRating);
            return (
              <div
                key={courier.courier}
                className="rounded-2xl border border-brand-border bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {courier.logo ? (
                      <Image
                        src={courier.logo}
                        alt={courier.courier}
                        width={28}
                        height={28}
                        className="h-7 w-7 rounded-md object-contain"
                        unoptimized
                      />
                    ) : (
                      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-light-bg text-brand-black">
                        <Truck className="h-4 w-4" />
                      </span>
                    )}
                    <p className="font-semibold text-gray-900">
                      {courier.courier}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset",
                      TONE_BADGE[courierTone],
                    )}
                  >
                    {riskLabelFromRate(courier.successRate, courier.total)}
                  </span>
                </div>

                {(rating || courier.message) && (
                  <p className="mt-2 text-xs text-gray-500">
                    {courier.message || rating}
                  </p>
                )}

                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <MiniStat
                    icon={<Truck className="h-3.5 w-3.5" />}
                    label={i18n("Total")}
                    value={courier.total}
                  />
                  <MiniStat
                    icon={<PackageCheck className="h-3.5 w-3.5" />}
                    label={i18n("OK")}
                    value={courier.success}
                    tone="text-emerald-600"
                  />
                  <MiniStat
                    icon={<PackageX className="h-3.5 w-3.5" />}
                    label={i18n("Cancel")}
                    value={courier.cancel}
                    tone="text-rose-600"
                  />
                </div>

                {courier.total > 0 && (
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-[11px] text-gray-500">
                      <span>{i18n("Success")}</span>
                      <span>{formatPercent(courier.successRate, locale)}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={cn("h-full", TONE_BAR[courierTone])}
                        style={{
                          width: `${Math.min(100, courier.successRate)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: RiskTone;
}) {
  const color =
    tone === "good"
      ? "text-emerald-700"
      : tone === "bad"
        ? "text-rose-700"
        : tone === "warn"
          ? "text-amber-700"
          : "text-gray-900";
  return (
    <div className="rounded-xl border border-brand-border bg-brand-light-bg p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className={cn("mt-1 text-lg font-bold", color)}>{value}</p>
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
  tone = "text-gray-700",
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className="rounded-lg bg-gray-50 px-1 py-2">
      <span className={cn("flex items-center justify-center gap-1", tone)}>
        {icon}
        <span className="text-sm font-bold">{value}</span>
      </span>
      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-gray-400">
        {label}
      </p>
    </div>
  );
}
