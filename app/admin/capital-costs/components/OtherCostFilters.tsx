"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { Search, X } from "lucide-react";

import type { OtherCostFilters as Filters } from "@/features/admin-capital-costs/api";

export default function OtherCostFilters({
  filters,
  setFilters,
  onApply,
  onReset,
  isLoading,
}: {
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  onApply: () => void;
  onReset: () => void;
  isLoading: boolean;
}) {
  const i18n = useInterfaceTranslations("AdminAdminCapitalCostsComponentsOtherCostFilters");
  const hasActiveFilter =
    Boolean(filters.search) ||
    Boolean(filters.dateFrom) ||
    Boolean(filters.dateTo) ||
    Boolean(filters.minAmount) ||
    Boolean(filters.maxAmount);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onApply();
      }}
      className="rounded-2xl border border-brand-border bg-brand-white p-4 shadow-sm"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="flex flex-col gap-1 text-xs sm:col-span-2 lg:col-span-1">
          <span className="font-semibold text-gray-600">{i18n("Search")}</span>
          <input
            value={filters.search}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, search: e.target.value }))
            }
            className="h-9 w-full rounded-lg border border-brand-border px-3 text-sm outline-none transition focus:border-brand-red"
            placeholder={i18n("Reason or note")}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-semibold text-gray-600">{i18n("From")}</span>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))
            }
            className="h-9 w-full rounded-lg border border-brand-border px-3 text-sm outline-none transition focus:border-brand-red"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-semibold text-gray-600">{i18n("To")}</span>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, dateTo: e.target.value }))
            }
            className="h-9 w-full rounded-lg border border-brand-border px-3 text-sm outline-none transition focus:border-brand-red"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-semibold text-gray-600">{i18n("Min amount")}</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={filters.minAmount}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, minAmount: e.target.value }))
            }
            className="h-9 w-full rounded-lg border border-brand-border px-3 text-sm outline-none transition focus:border-brand-red"
            placeholder="0"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-semibold text-gray-600">{i18n("Max amount")}</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={filters.maxAmount}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, maxAmount: e.target.value }))
            }
            className="h-9 w-full rounded-lg border border-brand-border px-3 text-sm outline-none transition focus:border-brand-red"
            placeholder={i18n("Any")}
          />
        </label>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        {hasActiveFilter && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-brand-border px-3 text-xs font-semibold text-foreground transition hover:bg-brand-light-bg"
          >
            <X className="h-3.5 w-3.5" />
            {i18n("Clear")}</button>
        )}
        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-red px-4 text-xs font-semibold text-white transition hover:bg-brand-red-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Search className="h-3.5 w-3.5" />
          {i18n("Apply filters")}</button>
      </div>
    </form>
  );
}
