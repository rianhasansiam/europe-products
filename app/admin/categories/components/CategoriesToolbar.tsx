"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { ChevronsDownUp, ChevronsUpDown, Plus, RotateCcw, Search } from "lucide-react";

import { LoadingSpinner } from "@/components/ui/loading";
import {
  STATUS_VALUES,
  type CategoryStatus,
} from "@/features/admin-categories/api";

type StatusFilter = "ALL" | CategoryStatus;

export default function CategoriesToolbar({
  query,
  statusFilter,
  visibleCount,
  totalCount,
  isLoading,
  onQueryChange,
  onStatusChange,
  onRefresh,
  onCreate,
  onExpandAll,
  onCollapseAll,
}: {
  query: string;
  statusFilter: StatusFilter;
  visibleCount: number;
  totalCount: number;
  isLoading: boolean;
  onQueryChange: (value: string) => void;
  onStatusChange: (value: StatusFilter) => void;
  onRefresh: () => void;
  onCreate: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}) {
  const i18n = useInterfaceTranslations("AdminAdminCategoriesComponentsCategoriesToolbar");
  return (
    <div className="rounded-2xl border border-brand-border bg-brand-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative flex flex-1 items-center">
            <Search className="pointer-events-none absolute left-3 h-4 w-4 text-brand-text-muted" />
            <input
              type="text"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder={i18n("Search by name, slug, description...")}
              className="h-10 w-full rounded-xl border border-brand-border ps-9 pe-3 text-sm outline-none transition focus:border-brand-red"
            />
          </label>

          <select
            value={statusFilter}
            onChange={(event) => onStatusChange(event.target.value as StatusFilter)}
            className="h-10 rounded-xl border border-brand-border px-3 text-sm outline-none transition focus:border-brand-red"
          >
            <option value="ALL">{i18n("All status")}</option>
            {STATUS_VALUES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onExpandAll}
            title={i18n("Expand all categories")}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-brand-border px-3 text-sm font-semibold text-brand-black transition hover:bg-brand-light-bg"
          >
            <ChevronsUpDown className="h-4 w-4" />
            <span className="hidden xl:inline">{i18n("Expand")}</span>
          </button>
          <button
            type="button"
            onClick={onCollapseAll}
            title={i18n("Collapse all categories")}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-brand-border px-3 text-sm font-semibold text-brand-black transition hover:bg-brand-light-bg"
          >
            <ChevronsDownUp className="h-4 w-4" />
            <span className="hidden xl:inline">{i18n("Collapse")}</span>
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            aria-busy={isLoading}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-brand-border px-3 text-sm font-semibold text-brand-black transition hover:bg-brand-light-bg"
          >
            {isLoading ? (
              <LoadingSpinner decorative size="sm" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            {isLoading ? i18n("Refreshing...") : i18n("Refresh")}
          </button>

          <button
            type="button"
            onClick={onCreate}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-red px-4 text-sm font-semibold text-brand-white transition hover:bg-brand-red-hover"
          >
            <Plus className="h-4 w-4" />
            {i18n("Add root category")}</button>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
        <span>
          {visibleCount} / {totalCount} {i18n("categories")}</span>
        {isLoading && (
          <span className="inline-flex items-center gap-1.5">
            <LoadingSpinner decorative size="xs" />
            {i18n("Syncing categories...")}</span>
        )}
      </div>
    </div>
  );
}
