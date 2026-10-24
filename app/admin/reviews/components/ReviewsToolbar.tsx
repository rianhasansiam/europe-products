"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { Plus, RotateCcw, Search, X } from "lucide-react";

import { LoadingSpinner } from "@/components/ui/loading";
import {
  REVIEW_SOURCE_VALUES,
  type ReviewSource,
} from "@/features/admin-reviews/api";

type SourceFilter = "ALL" | ReviewSource;
type RatingFilter = "ALL" | 1 | 2 | 3 | 4 | 5;

export default function ReviewsToolbar({
  query,
  sourceFilter,
  ratingFilter,
  visibleCount,
  totalCount,
  isLoading,
  showAddForm,
  onQueryChange,
  onSourceChange,
  onRatingChange,
  onToggleAddForm,
  onRefresh,
}: {
  query: string;
  sourceFilter: SourceFilter;
  ratingFilter: RatingFilter;
  visibleCount: number;
  totalCount: number;
  isLoading: boolean;
  showAddForm: boolean;
  onQueryChange: (value: string) => void;
  onSourceChange: (value: SourceFilter) => void;
  onRatingChange: (value: RatingFilter) => void;
  onToggleAddForm: () => void;
  onRefresh: () => void;
}) {
  const i18n = useInterfaceTranslations("AdminAdminReviewsComponentsReviewsToolbar");
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
              placeholder={i18n("Search by author, phone, product, title, comment...")}
              className="h-10 w-full rounded-xl border border-brand-border ps-9 pe-3 text-sm outline-none transition focus:border-brand-red"
            />
          </label>

          <select
            value={sourceFilter}
            onChange={(event) => onSourceChange(event.target.value as SourceFilter)}
            className="h-10 rounded-xl border border-brand-border px-3 text-sm outline-none transition focus:border-brand-red"
          >
            <option value="ALL">{i18n("All sources")}</option>
            {REVIEW_SOURCE_VALUES.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>

          <select
            value={String(ratingFilter)}
            onChange={(event) => {
              const value = event.target.value;
              onRatingChange(
                value === "ALL" ? "ALL" : (Number(value) as RatingFilter),
              );
            }}
            className="h-10 rounded-xl border border-brand-border px-3 text-sm outline-none transition focus:border-brand-red"
          >
            <option value="ALL">{i18n("All ratings")}</option>
            {[5, 4, 3, 2, 1].map((star) => (
              <option key={star} value={star}>
                {i18n("{count, plural, one {# star} other {# stars}}", { count: star })}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleAddForm}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-red px-3 text-sm font-semibold text-brand-white shadow-sm transition hover:bg-brand-red-hover"
          >
            {showAddForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showAddForm ? i18n("Close") : i18n("Add review")}
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
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
        <span>
          {visibleCount} / {totalCount} {i18n("reviews")}</span>
        {isLoading && (
          <span className="inline-flex items-center gap-1.5">
            <LoadingSpinner decorative size="xs" />
            {i18n("Syncing reviews...")}</span>
        )}
      </div>
    </div>
  );
}
