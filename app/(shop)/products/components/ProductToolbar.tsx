"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { ChevronDown, Grid3x3, List, SlidersHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { ProductSortOption } from "@/features/products/api";
import { cn } from "@/lib/utils";

type ViewMode = "grid" | "list";

type Props = {
  resultsCount: number;
  totalCount: number;
  pageSize: number;
  activeFilterCount: number;
  sort: ProductSortOption;
  onSortChange: (sort: ProductSortOption) => void;
  onPageSizeChange: (pageSize: number) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onOpenMobileFilter: () => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
};

const SORT_LABELS: Record<ProductSortOption, string> = {
  popular: "Most Popular",
  latest: "Newest First",
  "price-low": "Price: Low to High",
  "price-high": "Price: High to Low",
  rating: "Top Rated",
};

const SORT_OPTIONS = Object.keys(SORT_LABELS) as ProductSortOption[];

export default function ProductToolbar({
  resultsCount,
  totalCount,
  pageSize,
  activeFilterCount,
  sort,
  onSortChange,
  onPageSizeChange,
  viewMode,
  onViewModeChange,
  onOpenMobileFilter,
  sidebarOpen,
  onToggleSidebar,
}: Props) {
  const i18n = useInterfaceTranslations("InterfaceProductsComponentsProductToolbar");
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm sm:flex-nowrap sm:px-4">
      <div className="flex min-w-0 items-center gap-2">
        <Button
          type="button"
          onClick={onOpenMobileFilter}
          variant="secondary"
          size="sm"
          className="h-11 bg-secondary text-foreground transition-colors hover:bg-accent lg:hidden"
        >
          <SlidersHorizontal className="size-4" />
          {i18n("Filters")}{activeFilterCount > 0 && (
            <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] leading-none text-white">
              {activeFilterCount}
            </span>
          )}
        </Button>

        <Button
          type="button"
          onClick={onToggleSidebar}
          variant="secondary"
          size="sm"
          aria-label={sidebarOpen ? i18n("Hide filters") : i18n("Show filters")}
          aria-pressed={sidebarOpen}
          className="hidden h-11 bg-secondary text-foreground transition-colors hover:bg-accent lg:flex"
        >
          <SlidersHorizontal
            className={cn(
              "size-4 transition-transform duration-300",
              sidebarOpen ? "rotate-0" : "rotate-180",
            )}
          />
          {sidebarOpen ? i18n("Hide Filters") : i18n("Show Filters")}
        </Button>

        <p className="hidden text-xs text-body sm:block sm:text-sm">
          {i18n("Showing {shown, number} of {total, number}", { shown: resultsCount, total: totalCount })}
        </p>
        <p className="min-w-0 truncate text-xs text-body sm:hidden">
          {i18n("{count, plural, one {# result} other {# results}}", { count: totalCount })}</p>
      </div>

      <div className="ms-auto flex min-w-0 items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="group h-11 max-w-full bg-card text-body transition-colors hover:bg-secondary hover:text-primary data-[state=open]:bg-secondary data-[state=open]:text-primary"
            >
              <span className="hidden sm:inline">{i18n("Sort:")}</span>
              <span className="font-semibold">{i18n(SORT_LABELS[sort])}</span>
              <ChevronDown className="size-3.5 transition-transform duration-300 group-data-[state=open]:rotate-180" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuRadioGroup
              value={sort}
              onValueChange={(value) =>
                onSortChange(value as ProductSortOption)
              }
            >
              {SORT_OPTIONS.map((opt) => (
                <DropdownMenuRadioItem key={opt} value={opt}>
                  {i18n(SORT_LABELS[opt])}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <label className="hidden items-center gap-1 text-xs text-muted-foreground md:flex">
          {i18n("Show")}<select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="h-11 rounded-xl border border-border bg-card px-2 text-sm font-medium text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
            aria-label={i18n("Products per page")}
          >
            {[12, 24, 48].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <div className="hidden items-center rounded-lg border border-border bg-background p-0.5 sm:flex">
          <ViewToggle
            active={viewMode === "grid"}
            onClick={() => onViewModeChange("grid")}
            label={i18n("Grid view")}
          >
            <Grid3x3 className="size-4" />
          </ViewToggle>
          <ViewToggle
            active={viewMode === "list"}
            onClick={() => onViewModeChange("list")}
            label={i18n("List view")}
          >
            <List className="size-4" />
          </ViewToggle>
        </div>
      </div>
    </div>
  );
}

function ViewToggle({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  const i18n = useInterfaceTranslations("InterfaceProductsComponentsProductToolbar");
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={i18n(label)}
      aria-pressed={active}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-card text-primary shadow-sm"
          : "text-muted-foreground hover:bg-secondary hover:text-primary",
      )}
    >
      {children}
    </button>
  );
}
