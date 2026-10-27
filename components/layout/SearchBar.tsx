"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import {
  FolderTree,
  PackageSearch,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "@/lib/i18n/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading";
import CurrencyAmount from "@/components/currency/CurrencyAmount";
import {
  searchCatalogFromApi,
  type CatalogCategorySuggestion,
  type CatalogSearchResult,
  type Product,
} from "@/features/products/api";
import {
  buildSearchRecommendations,
  MIN_CATALOG_SEARCH_LENGTH,
  shouldRequestCatalogSearch,
} from "@/lib/catalog/search-recommendations";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 300;
const PRODUCT_RESULTS_LIMIT = 6;
const CATEGORY_RESULTS_LIMIT = 5;
const SEARCH_CACHE_LIMIT = 20;

type SearchBarProps = {
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  shouldFocus?: boolean;
  onNavigate?: () => void;
  recommendations?: readonly string[];
};

type SearchOption =
  | { kind: "product"; key: string; product: Product }
  | {
      kind: "category";
      key: string;
      category: CatalogCategorySuggestion;
    }
  | { kind: "phrase"; key: string; phrase: string }
  | { kind: "all"; key: "all" };

const EMPTY_RESULTS: CatalogSearchResult = {
  query: "",
  products: [],
  categories: [],
};

export default function SearchBar({
  className,
  inputClassName,
  placeholder = "Search products, codes, models and categories...",
  shouldFocus = false,
  onNavigate,
  recommendations = [],
}: SearchBarProps) {
  const i18n = useInterfaceTranslations("InterfaceLayoutSearchBar");
  const router = useRouter();
  const rawId = useId();
  const listboxId = `catalog-search-${rawId.replace(/:/g, "")}`;

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogSearchResult>(EMPTY_RESULTS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [retryToken, setRetryToken] = useState(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const resultCacheRef = useRef(new Map<string, CatalogSearchResult>());
  const trimmed = query.trim();
  const queryIsReady = shouldRequestCatalogSearch(trimmed);
  const recommendedSearches = useMemo(
    () => buildSearchRecommendations(recommendations, trimmed),
    [recommendations, trimmed],
  );
  const visibleProducts = useMemo(
    () => queryIsReady && !isLoading && !error ? results.products : [],
    [error, isLoading, queryIsReady, results.products],
  );
  const visibleCategories = useMemo(
    () => queryIsReady && !isLoading && !error ? results.categories : [],
    [error, isLoading, queryIsReady, results.categories],
  );
  const options = useMemo<SearchOption[]>(() => {
    return [
      ...visibleProducts.map(
        (product): SearchOption => ({
          kind: "product",
          key: `product-${product.id}`,
          product,
        }),
      ),
      ...visibleCategories.map(
        (category): SearchOption => ({
          kind: "category",
          key: `category-${category.id}`,
          category,
        }),
      ),
      ...recommendedSearches.map(
        (phrase): SearchOption => ({
          kind: "phrase",
          key: `phrase-${phrase.toLocaleLowerCase()}`,
          phrase,
        }),
      ),
      ...(trimmed
        ? ([{ kind: "all", key: "all" }] satisfies SearchOption[])
        : []),
    ];
  }, [recommendedSearches, trimmed, visibleCategories, visibleProducts]);
  const optionIndexByKey = useMemo(
    () => new Map(options.map((option, index) => [option.key, index])),
    [options],
  );

  useEffect(() => {
    if (!shouldFocus) return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [shouldFocus]);

  useEffect(() => {
    if (!queryIsReady) {
      const timer = setTimeout(() => {
        setResults(EMPTY_RESULTS);
        setError(null);
        setIsLoading(false);
        setActiveIndex(-1);
      }, 0);
      return () => clearTimeout(timer);
    }

    const cacheKey = trimmed.toLocaleLowerCase();
    const cached = resultCacheRef.current.get(cacheKey);
    if (cached) {
      const timer = setTimeout(() => {
        setResults(cached);
        setError(null);
        setIsLoading(false);
        setActiveIndex(-1);
      }, 0);
      return () => clearTimeout(timer);
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const nextResults = await searchCatalogFromApi(trimmed, {
          productLimit: PRODUCT_RESULTS_LIMIT,
          categoryLimit: CATEGORY_RESULTS_LIMIT,
          signal: controller.signal,
        });
        if (resultCacheRef.current.size >= SEARCH_CACHE_LIMIT) {
          const oldestKey = resultCacheRef.current.keys().next().value;
          if (oldestKey) resultCacheRef.current.delete(oldestKey);
        }
        resultCacheRef.current.set(cacheKey, nextResults);
        setResults(nextResults);
        setActiveIndex(-1);
        setError(null);
      } catch (searchError) {
        if (controller.signal.aborted) return;
        setResults(EMPTY_RESULTS);
        setActiveIndex(-1);
        setError(
          searchError instanceof Error
            ? searchError.message
            : "Failed to search the catalog.",
        );
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [queryIsReady, retryToken, trimmed]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const closeDropdown = () => {
    setOpen(false);
    setActiveIndex(-1);
  };

  const navigate = (href: string) => {
    closeDropdown();
    onNavigate?.();
    router.push(href);
  };

  const goToAllResults = () => {
    if (!trimmed) return;
    navigate(`/products?search=${encodeURIComponent(trimmed)}`);
  };

  const selectOption = (option: SearchOption | undefined) => {
    if (!option || option.kind === "all") {
      goToAllResults();
      return;
    }
    if (option.kind === "product") {
      navigate(`/products/${option.product.slug}`);
      return;
    }
    if (option.kind === "phrase") {
      navigate(`/products?search=${encodeURIComponent(option.phrase)}`);
      return;
    }
    navigate(`/categories/${option.category.path}`);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      if (options.length > 0) {
        setActiveIndex((index) => (index + 1) % options.length);
      }
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      if (options.length > 0) {
        setActiveIndex((index) =>
          index <= 0 ? options.length - 1 : index - 1,
        );
      }
      return;
    }
    if (event.key === "Home" && open && options.length > 0) {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (event.key === "End" && open && options.length > 0) {
      event.preventDefault();
      setActiveIndex(options.length - 1);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      selectOption(activeIndex >= 0 ? options[activeIndex] : undefined);
      return;
    }
    if (event.key === "Escape") {
      closeDropdown();
    }
  };

  const showDropdown =
    open && (trimmed.length > 0 || recommendedSearches.length > 0);
  const activeDescendant =
    activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined;

  return (
    <div ref={containerRef} className={cn("relative w-full min-w-0", className)}>
      <div className="relative w-full">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-label={i18n("Search the catalog")}
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-activedescendant={activeDescendant}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-busy={isLoading}
          autoComplete="off"
          enterKeyHint="search"
          value={query}
          onChange={(event) => {
            const next = event.target.value;
            setQuery(next);
            setResults(EMPTY_RESULTS);
            setError(null);
            setOpen(true);
            setActiveIndex(-1);
            setIsLoading(shouldRequestCatalogSearch(next));
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={i18n(placeholder)}
          className={cn(
            "h-11 rounded-xl border-input bg-card ps-11 pe-11 text-base text-foreground focus-visible:border-primary focus-visible:bg-card focus-visible:ring-ring/30",
            inputClassName,
          )}
        />
        {query && (
          <button
            type="button"
            aria-label={i18n("Clear search")}
            onClick={() => {
              setQuery("");
              setResults(EMPTY_RESULTS);
              setError(null);
              setIsLoading(false);
              setActiveIndex(-1);
              setOpen(true);
              inputRef.current?.focus();
            }}
            className="absolute end-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <X className="h-4 w-4 text-body" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute inset-x-0 top-full z-50 mt-1.5 max-h-[min(65dvh,30rem)] w-full max-w-full touch-pan-y overflow-y-auto overscroll-contain rounded-xl border border-border bg-card shadow-lg sm:mt-2">
          {isLoading && (
            <div
              role="status"
              className="flex items-center justify-center gap-2 border-b border-border px-3 py-4 text-sm text-primary"
            >
              <LoadingSpinner decorative size="sm" />
              <span>{i18n("Finding products and categories...")}</span>
            </div>
          )}

          {!isLoading && error && (
            <div
              role="alert"
              className="flex items-center justify-between gap-3 border-b border-red-100 bg-red-50 px-3 py-3 text-sm text-destructive"
            >
              <span className="min-w-0 break-words">{i18n(error)}</span>
              <button
                type="button"
                onClick={() => {
                  resultCacheRef.current.delete(trimmed.toLocaleLowerCase());
                  setError(null);
                  setIsLoading(queryIsReady);
                  setRetryToken((token) => token + 1);
                }}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-red-200 bg-card px-2.5 py-1.5 text-xs font-semibold text-destructive transition hover:bg-red-100"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {i18n("Retry")}</button>
            </div>
          )}

          <ul
            id={listboxId}
            role="listbox"
            aria-label={i18n("Catalog search suggestions")}
            className="min-w-0 py-1"
          >
            {!isLoading && !error && trimmed && !queryIsReady && (
              <li
                role="presentation"
                className="flex items-center gap-2 border-b border-border px-3 py-3 text-xs text-body"
              >
                <PackageSearch className="h-4 w-4 shrink-0 text-primary" />
                {i18n("Type at least {count, number} characters for live catalog matches.", { count: MIN_CATALOG_SEARCH_LENGTH })}</li>
            )}

            {!isLoading &&
              !error &&
              queryIsReady &&
              visibleProducts.length === 0 &&
              visibleCategories.length === 0 && (
                <li
                  role="presentation"
                  className="flex items-center gap-2 border-b border-border px-3 py-3 text-xs text-body"
                >
                  <PackageSearch className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 break-words">
                    {i18n("No direct matches for")}<strong>“{trimmed}”</strong>.
                  </span>
                </li>
              )}

            {visibleProducts.length > 0 && (
              <li role="presentation">
                  <div className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    {i18n("Products")}</div>
                  <ul role="group" aria-label={i18n("Products")}>
                    {visibleProducts.map((product) => {
                      const key = `product-${product.id}`;
                      const index = optionIndexByKey.get(key) ?? -1;
                      const finalPrice = product.discountPrice ?? product.price;
                      const hasDiscount =
                        product.discountPrice != null &&
                        product.discountPrice < product.price;
                      return (
                        <li
                          key={product.id}
                          id={`${listboxId}-option-${index}`}
                          role="option"
                          aria-selected={index === activeIndex}
                          onMouseEnter={() => setActiveIndex(index)}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => selectOption(options[index])}
                          className={cn(
                            "flex min-w-0 cursor-pointer items-center gap-2.5 px-2.5 py-2 text-start transition-colors sm:gap-3 sm:px-3",
                            index === activeIndex
                              ? "bg-secondary"
                              : "hover:bg-secondary",
                          )}
                        >
                          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-border bg-background sm:h-12 sm:w-12">
                            <Image
                              src={product.image}
                              alt=""
                              fill
                              className="object-cover"
                              sizes="48px"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">
                              {product.name}
                            </p>
                            <div className="mt-0.5 flex min-w-0 items-baseline justify-between gap-2">
                              <p className="min-w-0 truncate text-[11px] text-muted-foreground sm:text-xs">
                                {[
                                  product.modelNumber,
                                  product.category,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                              <div className="shrink-0 text-end">
                                <p className="whitespace-nowrap text-xs font-bold text-primary sm:text-sm">
                                  <CurrencyAmount amountUSD={finalPrice} />
                                </p>
                                {hasDiscount && (
                                  <p className="whitespace-nowrap text-[10px] text-muted-foreground line-through sm:text-[11px]">
                                    <CurrencyAmount amountUSD={product.price} />
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
              </li>
            )}

            {visibleCategories.length > 0 && (
              <li role="presentation" className="border-t border-border">
                  <div className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    {i18n("Categories")}</div>
                  <ul role="group" aria-label={i18n("Categories")}>
                    {visibleCategories.map((category) => {
                      const key = `category-${category.id}`;
                      const index = optionIndexByKey.get(key) ?? -1;
                      const breadcrumb = category.breadcrumb
                        .map((item) => item.name)
                        .join(" / ");
                      return (
                        <li
                          key={category.id}
                          id={`${listboxId}-option-${index}`}
                          role="option"
                          aria-selected={index === activeIndex}
                          onMouseEnter={() => setActiveIndex(index)}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => selectOption(options[index])}
                          className={cn(
                            "flex min-w-0 cursor-pointer items-center gap-2.5 px-2.5 py-2 text-start transition-colors sm:gap-3 sm:px-3",
                            index === activeIndex
                              ? "bg-secondary"
                              : "hover:bg-secondary",
                          )}
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background text-primary">
                            <FolderTree className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-foreground">
                              {category.name}
                            </span>
                            <span className="block truncate text-[11px] text-muted-foreground sm:text-xs">
                              {breadcrumb}
                            </span>
                          </span>
                          <span className="hidden shrink-0 whitespace-nowrap text-[11px] text-muted-foreground min-[360px]:inline">
                            {category.totalProductCount} {i18n("items")}</span>
                        </li>
                      );
                    })}
                  </ul>
              </li>
            )}

            {recommendedSearches.length > 0 && (
              <li role="presentation" className="border-t border-border">
                <div className="flex items-center gap-1.5 px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  <Sparkles className="h-3 w-3" />
                  {i18n("Recommended searches")}</div>
                <ul role="group" aria-label={i18n("Recommended searches")}>
                  {recommendedSearches.map((phrase) => {
                    const key = `phrase-${phrase.toLocaleLowerCase()}`;
                    const index = optionIndexByKey.get(key) ?? -1;
                    return (
                      <li
                        key={key}
                        id={`${listboxId}-option-${index}`}
                        role="option"
                        aria-selected={index === activeIndex}
                        onMouseEnter={() => setActiveIndex(index)}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectOption(options[index])}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-body transition-colors",
                          index === activeIndex
                            ? "bg-secondary text-primary"
                            : "hover:bg-secondary hover:text-primary",
                        )}
                      >
                        <Search className="h-3.5 w-3.5 shrink-0" />
                        <span className="min-w-0 truncate">{phrase}</span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            )}

            {trimmed &&
              (() => {
                const index = optionIndexByKey.get("all") ?? -1;
                return (
                  <li
                    id={`${listboxId}-option-${index}`}
                    role="option"
                    aria-selected={index === activeIndex}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectOption(options[index])}
                    className={cn(
                      "flex min-w-0 cursor-pointer items-center justify-center gap-1.5 border-t border-border bg-background px-3 py-2.5 text-sm font-semibold text-primary transition-colors",
                      index === activeIndex && "bg-secondary",
                    )}
                  >
                    <Search className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 truncate">
                      {i18n("Search all for “")}{trimmed}”
                    </span>
                  </li>
                );
              })()}
          </ul>
        </div>
      )}
    </div>
  );
}
