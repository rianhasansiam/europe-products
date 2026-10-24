"use client";
import { useLocale } from "next-intl";

import { useInterfaceTranslations } from "@/components/i18n/translate";


import { Plus, RotateCcw, Search } from "lucide-react";

import { LoadingSpinner } from "@/components/ui/loading";
import {
  CATALOG_ENTITY_STATUS_VALUES,
  type CatalogEntityStatus,
} from "@/features/admin-catalog-entities/api";

type StatusFilter = "ALL" | CatalogEntityStatus;

export default function CatalogEntityToolbar({
  singularLabel,
  pluralLabel,
  query,
  statusFilter,
  visibleCount,
  totalCount,
  isLoading,
  onQueryChange,
  onStatusChange,
  onRefresh,
  onCreate,
}: {
  singularLabel: string;
  pluralLabel: string;
  query: string;
  statusFilter: StatusFilter;
  visibleCount: number;
  totalCount: number;
  isLoading: boolean;
  onQueryChange: (value: string) => void;
  onStatusChange: (value: StatusFilter) => void;
  onRefresh: () => void;
  onCreate: () => void;
}) {
  const locale = useLocale();
  const i18n = useInterfaceTranslations("AdminAdminComponentsCatalogEntitiesCatalogEntityToolbar");
  return (
    <div className="rounded-2xl border border-brand-border bg-brand-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative flex flex-1 items-center">
            <span className="sr-only">{i18n("Search")}{" "}{pluralLabel}</span>
            <Search className="pointer-events-none absolute left-3 h-4 w-4 text-brand-text-muted" />
            <input
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder={`Search ${pluralLabel}, slugs, descriptions...`}
              className="h-10 w-full rounded-xl border border-brand-border ps-9 pe-3 text-sm outline-none transition focus:border-brand-red"
            />
          </label>

          <label>
            <span className="sr-only">{i18n("Filter by status")}</span>
            <select
              value={statusFilter}
              onChange={(event) =>
                onStatusChange(event.target.value as StatusFilter)
              }
              className="h-10 w-full rounded-xl border border-brand-border px-3 text-sm outline-none transition focus:border-brand-red sm:w-auto"
            >
              <option value="ALL">{i18n("All status")}</option>
              {CATALOG_ENTITY_STATUS_VALUES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            aria-busy={isLoading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-brand-border px-3 text-sm font-semibold text-brand-black transition hover:bg-brand-light-bg disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? (
              <LoadingSpinner decorative size="sm" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            {isLoading ? i18n("Refreshing") : i18n("Refresh")}
          </button>
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-brand-red px-4 text-sm font-semibold text-brand-white transition hover:bg-brand-red-hover"
          >
            <Plus className="h-4 w-4" />
            {i18n("Add")}{" "}{singularLabel}
          </button>
        </div>
      </div>

      <p className="mt-3 text-xs text-gray-500">
        {i18n("Showing")}{" "}{visibleCount.toLocaleString(locale)} {i18n("of")}{" "}{totalCount.toLocaleString(locale)} {pluralLabel}
      </p>
    </div>
  );
}
