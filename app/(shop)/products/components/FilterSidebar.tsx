"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { RotateCcw, Star } from "lucide-react";
import { useState } from "react";

import type {
  CatalogCategoryFacet,
  CatalogFacets,
} from "@/features/products/api";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/components/currency/CurrencyProvider";
import {
  priceAmount,
  normalizePrice,
} from "@/lib/currency/pricing.service";

export type CatalogFilterState = {
  categoryPath: string;
  minPrice: number | null;
  maxPrice: number | null;
  minRating: number;
  stock: "" | "in-stock" | "out-of-stock";
};

type Props = {
  filters: CatalogFilterState;
  onChange: (next: CatalogFilterState) => void;
  onReset: () => void;
  facets: CatalogFacets;
  className?: string;
};

type FlatCategory = CatalogCategoryFacet & { displayDepth: number };

function flattenCategories(
  categories: CatalogCategoryFacet[],
  displayDepth = 0,
): FlatCategory[] {
  return categories.flatMap((category) => [
    { ...category, displayDepth },
    ...flattenCategories(category.children, displayDepth + 1),
  ]);
}

export default function FilterSidebar({
  filters,
  onChange,
  onReset,
  facets,
  className,
}: Props) {
  const i18n = useInterfaceTranslations("InterfaceProductsComponentsFilterSidebar");
  const { pricingReady } = useCurrency();
  const categories = flattenCategories(facets.categories);

  const update = <K extends keyof CatalogFilterState>(
    key: K,
    value: CatalogFilterState[K],
  ) => onChange({ ...filters, [key]: value });

  const setMinRating = (rating: number) => {
    update("minRating", filters.minRating === rating ? 0 : rating);
  };

  return (
    <aside
      aria-label={i18n("Product filters")}
      className={cn(
        "sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-sm",
        className,
      )}
    >
      <div className="mb-2 flex items-center justify-between border-b border-border pb-3">
        <h2 className="text-base font-bold text-foreground">{i18n("Filters")}</h2>
        <button
          type="button"
          onClick={onReset}
          className="group flex items-center gap-1 text-xs font-semibold text-primary transition-colors hover:text-primary-hover"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {i18n("Reset")}</button>
      </div>

      <FilterGroup title={i18n("Category")}>
        <div className="max-h-64 space-y-1 overflow-y-auto pe-1">
          <FilterChoice
            active={!filters.categoryPath}
            label={i18n("All categories")}
            count={facets.categories.reduce(
              (total, category) => total + category.totalProductCount,
              0,
            )}
            onClick={() => update("categoryPath", "")}
          />
          {categories.map((category) => (
            <FilterChoice
              key={category.id}
              active={filters.categoryPath === category.path}
              label={category.name}
              count={category.totalProductCount}
              onClick={() => update("categoryPath", category.path)}
              style={{ paddingLeft: `${8 + Math.min(category.displayDepth, 4) * 14}px` }}
            />
          ))}
        </div>
      </FilterGroup>

      {pricingReady !== false && (
      <FilterGroup title={i18n("Price range")}>
        <PriceFilter
          key={`${filters.minPrice ?? ""}:${filters.maxPrice ?? ""}:${facets.priceBounds.min}:${facets.priceBounds.max}`}
          filters={filters}
          bounds={facets.priceBounds}
          onApply={(minPrice, maxPrice) =>
            onChange({ ...filters, minPrice, maxPrice })
          }
        />
      </FilterGroup>
      )}

      <FilterGroup title={i18n("Customer rating")}>
        <div className="space-y-1">
          {[4, 3, 2, 1].map((rating) => (
            <button
              key={rating}
              type="button"
              onClick={() => setMinRating(rating)}
              aria-pressed={filters.minRating === rating}
              className={cn(
                "flex w-full items-center gap-2 min-h-11 rounded-xl px-2 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                filters.minRating === rating
                  ? "bg-primary/10 text-primary"
                  : "text-body hover:bg-background",
              )}
            >
              <span className="flex" aria-label={i18n("{value0} stars and up", { value0: rating })}>
                {Array.from({ length: 5 }).map((_, index) => (
                  <Star
                    key={index}
                    aria-hidden="true"
                    className={cn(
                      "h-3.5 w-3.5",
                      index < rating
                        ? "fill-brand-gold text-brand-gold"
                        : "text-border",
                    )}
                  />
                ))}
              </span>
              <span className="text-xs">{i18n("& up")}</span>
            </button>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title={i18n("Availability")} last>
        <div className="space-y-1">
          <FilterChoice
            active={!filters.stock}
            label={i18n("Any availability")}
            count={facets.availability.inStock + facets.availability.outOfStock}
            onClick={() => update("stock", "")}
          />
          <FilterChoice
            active={filters.stock === "in-stock"}
            label={i18n("In stock")}
            count={facets.availability.inStock}
            onClick={() => update("stock", "in-stock")}
          />
          <FilterChoice
            active={filters.stock === "out-of-stock"}
            label={i18n("Out of stock")}
            count={facets.availability.outOfStock}
            onClick={() => update("stock", "out-of-stock")}
          />
        </div>
      </FilterGroup>
    </aside>
  );
}

function FilterChoice({
  active,
  label,
  count,
  onClick,
  style,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
  style?: React.CSSProperties;
}) {
  const i18n = useInterfaceTranslations("InterfaceProductsComponentsFilterSidebar");
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      style={style}
      className={cn(
        "flex w-full items-center justify-between gap-2 min-h-11 rounded-xl px-2 py-2 text-start text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-primary/10 font-semibold text-primary"
          : "text-body hover:bg-background hover:text-primary",
      )}
    >
      <span className="min-w-0 truncate">{i18n(label)}</span>
      <span className="shrink-0 text-[11px] text-muted-foreground">{count}</span>
    </button>
  );
}

function PriceFilter({
  filters,
  bounds,
  onApply,
}: {
  filters: CatalogFilterState;
  bounds: { min: number; max: number };
  onApply: (minPrice: number | null, maxPrice: number | null) => void;
}) {
  const i18n = useInterfaceTranslations("InterfaceProductsComponentsFilterSidebar");
  const currencyContext = useCurrency();
  const display = (amount: number) =>
    priceAmount({ baseAmount: amount, context: currencyContext }).amount;
  const [min, setMin] = useState(
    filters.minPrice == null ? "" : display(filters.minPrice).toString(),
  );
  const [max, setMax] = useState(
    filters.maxPrice == null ? "" : display(filters.maxPrice).toString(),
  );
  const displayBounds = {
    min: display(bounds.min),
    max: display(bounds.max),
  };

  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        const parsedMin = min.trim() === "" ? null : Math.max(0, Number(min));
        const parsedMax = max.trim() === "" ? null : Math.max(0, Number(max));
        const validMin =
          parsedMin != null && Number.isFinite(parsedMin) ? parsedMin : null;
        const validMax =
          parsedMax != null && Number.isFinite(parsedMax) ? parsedMax : null;
        const canonicalMin =
          validMin == null
            ? null
            : normalizePrice({ amount: validMin, context: currencyContext });
        const canonicalMax =
          validMax == null
            ? null
            : normalizePrice({ amount: validMax, context: currencyContext });
        onApply(
          canonicalMin != null && canonicalMax != null
            ? Math.min(canonicalMin, canonicalMax)
            : canonicalMin,
          canonicalMin != null && canonicalMax != null
            ? Math.max(canonicalMin, canonicalMax)
            : canonicalMax,
        );
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs font-medium text-body">
          {i18n("Minimum (")}{currencyContext.currency})
          <input
            inputMode="decimal"
            type="number"
            min={0}
            max={displayBounds.max || undefined}
            value={min}
            onChange={(event) => setMin(event.target.value)}
            placeholder={String(displayBounds.min)}
            className="mt-1 h-11 w-full rounded-xl bg-card border border-border px-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
          />
        </label>
        <label className="text-xs font-medium text-body">
          {i18n("Maximum (")}{currencyContext.currency})
          <input
            inputMode="decimal"
            type="number"
            min={0}
            max={displayBounds.max || undefined}
            value={max}
            onChange={(event) => setMax(event.target.value)}
            placeholder={String(displayBounds.max)}
            className="mt-1 h-11 w-full rounded-xl bg-card border border-border px-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
          />
        </label>
      </div>
      <button
        type="submit"
        className="h-11 w-full rounded-xl border border-primary/20 bg-primary/5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
      >
        {i18n("Apply price")}</button>
    </form>
  );
}

function FilterGroup({
  title,
  children,
  last,
}: {
  title: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  const i18n = useInterfaceTranslations("InterfaceProductsComponentsFilterSidebar");
  return (
    <section className={`py-4 ${last ? "" : "border-b border-border"}`}>
      <h3 className="mb-3 text-sm font-semibold text-foreground">
        {i18n(title)}
      </h3>
      {children}
    </section>
  );
}
