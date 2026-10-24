"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { Plus, RotateCcw } from "lucide-react";

import { LoadingSpinner } from "@/components/ui/loading";
import type { ProductStatus } from "@/features/admin-products/api";

type CategoryChoice = { id: string; name: string };

export default function ProductsToolbar({
  query,
  statusFilter,
  categoryFilter,
  categoryOptions,
  visibleCount,
  totalCount,
  isLoading,
  onQueryChange,
  onStatusChange,
  onCategoryChange,
  onRefresh,
  onCreate,
}: {
  query: string;
  statusFilter: "ALL" | ProductStatus;
  categoryFilter: "ALL" | string;
  categoryOptions: CategoryChoice[];
  visibleCount: number;
  totalCount: number;
  isLoading: boolean;
  onQueryChange: (value: string) => void;
  onStatusChange: (value: "ALL" | ProductStatus) => void;
  onCategoryChange: (value: "ALL" | string) => void;
  onRefresh: () => void;
  onCreate: () => void;
}) {
  const i18n = useInterfaceTranslations("AdminAdminProductsComponentsProductsToolbar");
  return (
    <div className="rounded-2xl border border-brand-border bg-brand-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="text"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={i18n("Search name, code, model, brand, category, SKU...")}
            className="h-10 w-full rounded-xl border border-brand-border px-3 text-sm outline-none transition focus:border-brand-red"
          />

          <select
            value={statusFilter}
            onChange={(event) =>
              onStatusChange(event.target.value as "ALL" | ProductStatus)
            }
            className="h-10 rounded-xl border border-brand-border px-3 text-sm outline-none transition focus:border-brand-red"
          >
            <option value="ALL">{i18n("All status")}</option>
            <option value="ACTIVE">{i18n("Active")}</option>
            <option value="INACTIVE">{i18n("Inactive")}</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(event) => onCategoryChange(event.target.value)}
            className="h-10 rounded-xl border border-brand-border px-3 text-sm outline-none transition focus:border-brand-red"
          >
            <option value="ALL">{i18n("All categories")}</option>
            {categoryOptions.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            aria-busy={isLoading}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-brand-border px-3 text-sm font-semibold text-foreground transition hover:bg-brand-light-bg"
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
            {i18n("Create Product")}</button>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
        <span>
          {visibleCount} / {totalCount} {i18n("products")}</span>
        {isLoading && (
          <span className="inline-flex items-center gap-1.5">
            <LoadingSpinner decorative size="xs" />
            {i18n("Syncing products...")}</span>
        )}
      </div>
    </div>
  );
}
