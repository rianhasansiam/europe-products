"use client";
import { useLocale } from "next-intl";

import { useInterfaceTranslations } from "@/components/i18n/translate";


import {
  Boxes,
  History,
  Pencil,
  PlusCircle,
  Trash2,
  User,
  Wallet,
} from "lucide-react";

import {
  formatCurrency,
  formatDateTime,
  type ActivityKind,
  type ActivityRow,
} from "@/features/admin-capital-costs/api";
import { cn } from "@/lib/utils";

/**
 * Read-only feed of recent capital, product-cost, and manual-cost changes.
 */

const KIND_META: Record<
  ActivityKind,
  { label: string; icon: typeof Wallet; tone: string }
> = {
  CAPITAL_SET: {
    label: "Capital set",
    icon: Wallet,
    tone: "bg-emerald-50 text-emerald-600",
  },
  CAPITAL_UPDATED: {
    label: "Capital updated",
    icon: Wallet,
    tone: "bg-emerald-50 text-emerald-600",
  },
  CAPITAL_ADDED: {
    label: "Capital added",
    icon: Wallet,
    tone: "bg-emerald-50 text-emerald-600",
  },
  PRODUCT_COST_ADDED: {
    label: "Product cost added",
    icon: Boxes,
    tone: "bg-brand-light-bg text-brand-red",
  },
  PRODUCT_COST_REMOVED: {
    label: "Product cost removed",
    icon: Trash2,
    tone: "bg-rose-50 text-rose-600",
  },
  COST_CREATED: {
    label: "Cost added",
    icon: PlusCircle,
    tone: "bg-brand-light-bg text-brand-red",
  },
  COST_UPDATED: {
    label: "Cost updated",
    icon: Pencil,
    tone: "bg-amber-50 text-amber-600",
  },
  COST_DELETED: {
    label: "Cost deleted",
    icon: Trash2,
    tone: "bg-rose-50 text-rose-600",
  },
};

function actorLabel(entry: ActivityRow): string {
  return entry.actorName || entry.actorEmail || "Unknown admin";
}

export default function CapitalCostActivity({
  activity,
  currency,
  isLoading,
}: {
  activity: ActivityRow[];
  currency: string;
  isLoading: boolean;
}) {
  const locale = useLocale();
  const i18n = useInterfaceTranslations("AdminAdminCapitalCostsComponentsCapitalCostActivity");
  return (
    <div className="rounded-2xl border border-brand-border bg-brand-white p-4 shadow-sm sm:p-5">
      <header className="mb-4">
        <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
          <History className="h-4 w-4 text-brand-red" />
          {i18n("Page activity")}</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          {i18n("Recent capital changes and cost edits on this page.")}</p>
      </header>

      {isLoading && activity.length === 0 ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-xl bg-brand-light-bg"
            />
          ))}
        </div>
      ) : activity.length === 0 ? (
        <div className="rounded-xl border border-dashed border-brand-border bg-brand-light-bg p-8 text-center text-sm text-gray-600">
          <History className="mx-auto mb-2 h-7 w-7 text-brand-text-muted" />
          {i18n("No activity yet. Capital and cost changes will appear here.")}</div>
      ) : (
        <ol className="relative space-y-3">
          {activity.map((entry) => {
            const meta = KIND_META[entry.type];
            const Icon = meta.icon;
            return (
              <li
                key={entry.id}
                className="flex items-start gap-3 rounded-xl border border-brand-border bg-brand-white p-3"
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                    meta.tone,
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                    <p className="text-sm font-semibold text-brand-black">
                      {entry.description}
                    </p>
                    {entry.amount !== null && (
                      <span className="text-sm font-bold text-gray-700">
                        {formatCurrency(entry.amount, entry.currency || currency, locale)}
                      </span>
                    )}
                  </div>
                  {entry.note && (
                    <p className="mt-0.5 truncate text-xs text-gray-500">
                      {entry.note}
                    </p>
                  )}
                  <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[11px] uppercase tracking-wide text-gray-400">
                    <span className="inline-flex items-center gap-1 normal-case text-gray-500">
                      <User className="h-3 w-3" />
                      {actorLabel(entry)}
                    </span>
                    <span aria-hidden>·</span>
                    {meta.label}
                    <span aria-hidden>·</span>
                    {formatDateTime(entry.createdAt, locale)}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
