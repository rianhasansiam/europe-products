"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import {
  Search,
  X,
  LayoutGrid,
  List,
  ArrowUpDown,
  CheckSquare,
  Square,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type WishlistView = "grid" | "list";

type WishlistSort =
  | "recent"
  | "oldest"
  | "price-asc"
  | "price-desc"
  | "rating";

type WishlistToolbarProps = {
  query: string;
  onQueryChange: (value: string) => void;
  sort: WishlistSort;
  onSortChange: (value: WishlistSort) => void;
  view: WishlistView;
  onViewChange: (value: WishlistView) => void;
  categories: string[];
  activeCategory: string;
  onCategoryChange: (value: string) => void;
  totalCount: number;
  visibleCount: number;
  allSelected: boolean;
  onToggleSelectAll: () => void;
};

const SORT_OPTIONS: { value: WishlistSort; label: string }[] = [
  { value: "recent", label: "Recently added" },
  { value: "oldest", label: "Oldest first" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "rating", label: "Top rated" },
];

export default function WishlistToolbar({
  query,
  onQueryChange,
  sort,
  onSortChange,
  view,
  onViewChange,
  categories,
  activeCategory,
  onCategoryChange,
  totalCount,
  visibleCount,
  allSelected,
  onToggleSelectAll,
}: WishlistToolbarProps) {
  const i18n = useInterfaceTranslations("InterfaceWishlistComponentsWishlistToolbar");
  return (
    <div className="sticky top-[68px] z-30 -mx-2 mt-6 rounded-2xl border border-border bg-card/85 px-3 py-3 shadow-sm backdrop-blur-lg sm:mx-0 sm:px-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Search */}
        <div className="relative flex-1 lg:max-w-sm">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={i18n("Search your wishlist...")}
            className="h-10 rounded-xl border-border bg-card ps-10 pe-9 text-sm focus-visible:border-primary focus-visible:ring-ring/20"
          />
          {query && (
            <button
              type="button"
              aria-label={i18n("Clear search")}
              onClick={() => onQueryChange("")}
              className="absolute end-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-secondary"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Select all */}
          <button
            type="button"
            onClick={onToggleSelectAll}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:border-primary hover:bg-background hover:text-primary"
          >
            {allSelected ? (
              <CheckSquare className="h-4 w-4 text-primary" />
            ) : (
              <Square className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">
              {allSelected ? i18n("Deselect all") : i18n("Select all")}
            </span>
          </button>

          {/* Sort */}
          <div className="relative">
            <ArrowUpDown className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <select
              value={sort}
              onChange={(e) => onSortChange(e.target.value as WishlistSort)}
              className="h-10 cursor-pointer appearance-none rounded-xl border border-border bg-card ps-9 pe-8 text-sm font-medium text-foreground transition-colors hover:border-primary hover:bg-background focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {i18n(opt.label)}
                </option>
              ))}
            </select>
          </div>

          {/* View toggle */}
          <div
            role="group"
            aria-label={i18n("View")}
            className="flex h-10 items-center rounded-xl border border-border bg-card p-0.5"
          >
            <ViewButton
              active={view === "grid"}
              onClick={() => onViewChange("grid")}
              label={i18n("Grid view")}
            >
              <LayoutGrid className="h-4 w-4" />
            </ViewButton>
            <ViewButton
              active={view === "list"}
              onClick={() => onViewChange("list")}
              label={i18n("List view")}
            >
              <List className="h-4 w-4" />
            </ViewButton>
          </div>
        </div>
      </div>

      {/* Category chips */}
      {categories.length > 0 && (
        <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none [&::-webkit-scrollbar]:hidden">
          <CategoryChip
            label={i18n("All ({value0})", { value0: totalCount })}
            active={activeCategory === "all"}
            onClick={() => onCategoryChange("all")}
          />
          {categories.map((cat) => (
            <CategoryChip
              key={cat}
              label={cat}
              active={activeCategory === cat}
              onClick={() => onCategoryChange(cat)}
            />
          ))}
          <span className="ms-auto whitespace-nowrap text-xs text-muted-foreground">
            {i18n("{shown, number} of {total, number} shown", { shown: visibleCount, total: totalCount })}</span>
        </div>
      )}
    </div>
  );
}

function ViewButton({
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
  const i18n = useInterfaceTranslations("InterfaceWishlistComponentsWishlistToolbar");
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={i18n(label)}
      aria-pressed={active}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-200",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-background hover:text-primary",
      )}
    >
      {children}
    </button>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const i18n = useInterfaceTranslations("InterfaceWishlistComponentsWishlistToolbar");
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all duration-200",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border bg-card text-foreground hover:border-primary hover:text-primary",
      )}
    >
      {i18n(label)}
    </button>
  );
}
