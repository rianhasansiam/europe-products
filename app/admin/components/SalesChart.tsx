"use client";
import { BASE_CURRENCY } from "@/lib/currency/config";
import { useLocale } from "next-intl";

import { useInterfaceTranslations } from "@/components/i18n/translate";


import { useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";

import type { DashboardSalesSeries } from "@/features/admin-dashboard/api";
import { cn } from "@/lib/utils";

type Range = "7d" | "14d";

const FALLBACK_SERIES: DashboardSalesSeries = {
  days: 0,
  points: [],
  totalSales: 0,
  totalOrders: 0,
};

type SalesChartProps = {
  sales: DashboardSalesSeries | null;
  loading?: boolean;
};

const CHART_WIDTH = 600;
const CHART_HEIGHT = 220;
const CHART_PAD = { l: 44, r: 16, t: 16, b: 28 } as const;

/**
 * Sales overview chart for the admin dashboard.
 *
 * Renders a hand-rolled SVG line chart so we don't pull in a 30 KB
 * charting dependency for one widget. The 7d/14d toggle slices the
 * server-provided series client-side; the server always returns 14
 * days because that's the largest range the chart can show.
 */
export default function SalesChart({ sales, loading }: SalesChartProps) {
  const locale = useLocale();
  const i18n = useInterfaceTranslations("AdminAdminComponentsSalesChart");
  const [range, setRange] = useState<Range>("14d");

  const series = sales ?? FALLBACK_SERIES;

  const points = useMemo(() => {
    const all = series.points;
    if (range === "7d") return all.slice(-7);
    return all;
  }, [range, series.points]);

  const hasData = points.length > 0;
  const totalSales = useMemo(
    () => points.reduce((sum, point) => sum + point.sales, 0),
    [points],
  );
  const totalOrders = useMemo(
    () => points.reduce((sum, point) => sum + point.orders, 0),
    [points],
  );

  // SVG plotting maths kept intentionally simple: one viewBox, the
  // outer container handles responsive scaling via Tailwind classes.
  const innerW = CHART_WIDTH - CHART_PAD.l - CHART_PAD.r;
  const innerH = CHART_HEIGHT - CHART_PAD.t - CHART_PAD.b;

  const max = useMemo(() => {
    const peak = points.reduce((m, p) => (p.sales > m ? p.sales : m), 0);
    // A flat-zero series should still render a baseline grid, so we
    // pretend the max is 1 to avoid divide-by-zero downstream.
    return peak === 0 ? 1 : peak;
  }, [points]);

  const plotted = useMemo(() => {
    if (points.length === 0) return [];
    const denominator = Math.max(1, points.length - 1);
    return points.map((point, index) => {
      const x = CHART_PAD.l + (innerW * index) / denominator;
      const y = CHART_PAD.t + innerH - (point.sales / max) * innerH;
      return { ...point, x, y };
    });
  }, [innerH, innerW, max, points]);

  const linePath = plotted
    .map(
      (p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`,
    )
    .join(" ");

  const areaPath =
    plotted.length === 0
      ? ""
      : `M ${plotted[0].x.toFixed(1)} ${(CHART_PAD.t + innerH).toFixed(1)} ` +
        plotted.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") +
        ` L ${plotted[plotted.length - 1].x.toFixed(1)} ${(CHART_PAD.t + innerH).toFixed(1)} Z`;

  const yTicks = 4;
  const tickValues = Array.from({ length: yTicks + 1 }, (_, i) =>
    Math.round((max * (yTicks - i)) / yTicks),
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-brand-border bg-white p-4 shadow-sm sm:p-5">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-brand-red" />
            <h2 className="text-sm font-bold text-gray-900">{i18n("Sales Overview")}</h2>
            <span className="text-[11px] font-medium text-gray-500">
              {i18n("· last")}{" "}{range === "7d" ? "7" : "14"} {i18n("days")}</span>
          </div>
          <div className="mt-2 flex items-end gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                {i18n("Sales")}</p>
              {loading ? (
                <div className="mt-1 h-7 w-32 animate-pulse rounded-md bg-brand-light-bg" />
              ) : (
                <p className="text-xl font-extrabold text-gray-900">
                  {BASE_CURRENCY} {Math.round(totalSales).toLocaleString(locale)}
                </p>
              )}
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                {i18n("Orders")}</p>
              {loading ? (
                <div className="mt-1 h-7 w-16 animate-pulse rounded-md bg-brand-light-bg" />
              ) : (
                <p className="text-xl font-extrabold text-gray-900">
                  {totalOrders.toLocaleString(locale)}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="inline-flex rounded-xl border border-brand-border bg-brand-light-bg p-1 text-xs font-bold">
          {(["7d", "14d"] as Range[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={cn(
                "rounded-lg px-3 py-1.5 transition-all duration-200",
                range === r
                  ? "bg-brand-white text-brand-red shadow-sm"
                  : "text-gray-600 hover:text-brand-red",
              )}
            >
              {r === "7d" ? i18n("7 days") : i18n("14 days")}
            </button>
          ))}
        </div>
      </header>

      <div className="relative -mx-2 overflow-hidden">
        {loading ? (
          <div className="h-56 w-full animate-pulse rounded-xl bg-brand-light-bg" />
        ) : !hasData ? (
          <div className="grid h-56 w-full place-items-center text-sm text-gray-500">
            {i18n("No orders yet in this window.")}</div>
        ) : (
          <svg
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            className="h-56 w-full"
            role="img"
            aria-label={i18n("Sales trend")}
          >
            <defs>
              <linearGradient id="salesArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--brand-red)" stopOpacity="0.35" />
                <stop offset="100%" stopColor="var(--brand-red)" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Y grid + labels */}
            {tickValues.map((value, i) => {
              const y = CHART_PAD.t + (innerH * i) / yTicks;
              return (
                <g key={`tick-${i}`}>
                  <line
                    x1={CHART_PAD.l}
                    x2={CHART_WIDTH - CHART_PAD.r}
                    y1={y}
                    y2={y}
                    stroke="var(--brand-border)"
                    strokeDasharray="3 4"
                  />
                  <text
                    x={CHART_PAD.l - 6}
                    y={y + 4}
                    textAnchor="end"
                    className="fill-gray-400"
                    fontSize="10"
                  >
                    {formatTick(value, locale)}
                  </text>
                </g>
              );
            })}

            {/* Area + line */}
            <path d={areaPath} fill="url(#salesArea)" />
            <path
              d={linePath}
              fill="none"
              stroke="var(--brand-red)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Points */}
            {plotted.map((p, i) => (
              <g key={`point-${i}`}>
                <title>{`${p.label} · ${BASE_CURRENCY} ${p.sales.toLocaleString(locale)} · ${p.orders} orders`}</title>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="3.5"
                  fill="#fff"
                  stroke="var(--brand-red)"
                  strokeWidth="2"
                />
                <text
                  x={p.x}
                  y={CHART_HEIGHT - 8}
                  textAnchor="middle"
                  className="fill-gray-500"
                  fontSize="10"
                >
                  {p.label}
                </text>
              </g>
            ))}
          </svg>
        )}
      </div>
    </section>
  );
}

function formatTick(value: number, locale = "en"): string {
  return `${BASE_CURRENCY} ${new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(value)}`;
}
