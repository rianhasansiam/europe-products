"use client";
import { BASE_CURRENCY } from "@/lib/currency/config";
import { useLocale } from "next-intl";

import { useInterfaceTranslations } from "@/components/i18n/translate";


import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  ShoppingBag,
  Undo2,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { DashboardStats, DashboardTrend } from "@/features/admin-dashboard/api";
import { cn } from "@/lib/utils";

type Accent = "violet" | "emerald" | "amber" | "indigo";

const ACCENT_STYLES: Record<Accent, { ring: string; tile: string; icon: string }> = {
  violet: {
    ring: "bg-brand-red/15",
    tile: "bg-brand-red/10 text-brand-red",
    icon: "text-brand-red",
  },
  indigo: {
    ring: "bg-brand-red/15",
    tile: "bg-brand-red/10 text-brand-red",
    icon: "text-brand-red",
  },
  emerald: {
    ring: "bg-brand-red/15",
    tile: "bg-brand-red/10 text-brand-red",
    icon: "text-brand-red",
  },
  amber: {
    ring: "bg-brand-red/15",
    tile: "bg-brand-red/10 text-brand-red",
    icon: "text-brand-red",
  },
};

type CardConfig = {
  id: keyof DashboardStats;
  label: string;
  hint: string;
  accent: Accent;
  icon: LucideIcon | string;
  format: (value: number, locale?: string) => string;
  /**
   * Some metrics (e.g. cancellations) are healthier when going down.
   * `up`/`down`/`flat` is computed by the service so the card just
   * needs to know which direction to colour as positive.
   */
  positiveTrend?: DashboardTrend;
};

function formatUsd(value: number, locale = "en"): string {
  return `${BASE_CURRENCY} ${Math.round(value).toLocaleString(locale)}`;
}

function formatCount(value: number, locale = "en"): string {
  return value.toLocaleString(locale);
}

const CARDS: readonly CardConfig[] = [
  {
    id: "sales",
    label: "Sales (all time)",
    hint: "growth this month",
    accent: "violet",
    icon: "",
    format: formatUsd,
    positiveTrend: "up",
  },
  {
    id: "orders",
    label: "Orders (all time)",
    hint: "growth this month",
    accent: "indigo",
    icon: ShoppingBag,
    format: formatCount,
    positiveTrend: "up",
  },
  {
    id: "customers",
    label: "Customers (all time)",
    hint: "growth this month",
    accent: "emerald",
    icon: Users,
    format: formatCount,
    positiveTrend: "up",
  },
  {
    id: "cancellations",
    label: "Cancellations (all time)",
    hint: "growth this month",
    accent: "amber",
    icon: Undo2,
    format: formatCount,
    positiveTrend: "down",
  },
];

type StatCardsProps = {
  stats: DashboardStats | null;
  loading?: boolean;
};

export default function StatCards({ stats, loading }: StatCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {CARDS.map((card) => {
        const stat = stats?.[card.id] ?? null;
        return (
          <StatCard
            key={card.id}
            card={card}
            stat={stat}
            loading={loading || !stats}
          />
        );
      })}
    </div>
  );
}

type StatCardProps = {
  card: CardConfig;
  stat: DashboardStats[keyof DashboardStats] | null;
  loading: boolean;
};

function StatCard({ card, stat, loading }: StatCardProps) {
  const locale = useLocale();
  const i18n = useInterfaceTranslations("AdminAdminComponentsStatCards");
  const styles = ACCENT_STYLES[card.accent];
  const Icon = card.icon;

  const TrendIcon =
    stat?.trend === "down"
      ? ArrowDownRight
      : stat?.trend === "up"
        ? ArrowUpRight
        : ArrowRight;

  const positive = stat
    ? stat.trend === "flat"
      ? null
      : stat.trend === card.positiveTrend
    : null;

  const deltaPill =
    positive === null
      ? "bg-gray-100 text-gray-600"
      : positive
        ? "bg-emerald-50 text-emerald-700"
        : "bg-red-50 text-red-600";

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-brand-border bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full opacity-60 blur-2xl transition-opacity duration-300 group-hover:opacity-100",
          styles.ring,
        )}
      />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {i18n(card.label)}
          </p>
          {loading ? (
            <div className="mt-2 h-8 w-32 animate-pulse rounded-md bg-brand-light-bg" />
          ) : (
            <p className="mt-2 text-2xl font-extrabold text-gray-900">
              {stat ? card.format(stat.current, locale) : "—"}
            </p>
          )}
        </div>
        <div className={cn("rounded-xl p-2.5", styles.tile)}>
          {typeof Icon === "string" ? (
            <span className={cn("text-sm font-semibold", styles.icon)}>{Icon}</span>
          ) : (
            <Icon className={cn("h-5 w-5", styles.icon)} />
          )}
        </div>
      </div>

      <div className="relative mt-3 flex items-center gap-2">
        {loading ? (
          <span className="h-4 w-24 animate-pulse rounded-full bg-brand-light-bg" />
        ) : stat ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold",
              deltaPill,
            )}
          >
            <TrendIcon className="h-3 w-3" />
            {formatDelta(stat.delta, locale)}
          </span>
        ) : (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-500">
            —
          </span>
        )}
        <span className="text-[11px] font-medium text-gray-500">
          {i18n(card.hint)}
        </span>
      </div>
    </article>
  );
}

function formatDelta(delta: number, locale = "en"): string {
  if (!Number.isFinite(delta)) return "—";
  // Trim a trailing .0 so 12.0% renders as 12%.
  const rounded = Math.round(delta * 10) / 10;
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero" }).format(rounded / 100);
}
