"use client";
import PricingUnavailable from "@/components/currency/PricingUnavailable";
import { useCurrency } from "@/components/currency/CurrencyProvider";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "@/lib/i18n/navigation";
import { useSession } from "@/lib/auth/use-app-session";
import { useDispatch, useSelector } from "react-redux";

import WishlistHero from "./components/WishlistHero";
import WishlistToolbar from "./components/WishlistToolbar";
import WishlistCard from "./components/WishlistCard";
import EmptyWishlist from "./components/EmptyWishlist";
import BulkActionsBar from "./components/BulkActionsBar";
import SavedForLater from "@/app/(shop)/cart/components/SavedForLater";
import {
  setWishlistError,
  setWishlistItems,
} from "@/store/slices/wishlist.slice";
import {
  setCartData,
  setCartError as setCartErrorAction,
} from "@/store/slices/cart.slice";
import type { AppDispatch, RootState } from "@/store";
import {
  createCartItemOnServer as addCartItemOnServer,
  fetchServerCartSnapshot,
} from "@/features/cart/api";
import { computeCartSummary } from "@/features/cart/summary";
import {
  readLocalCart,
  upsertLocalCartItem,
  writeLocalCart,
} from "@/features/cart/storage";
import {
  isServerWishlistRole,
  removeWishlistItemOnServer,
} from "@/features/wishlist/api";
import { writeLocalWishlist } from "@/features/wishlist/storage";
import {
  readLocalSaved,
  type SavedItem,
  writeLocalSaved,
} from "@/features/cart/saved-storage";
import { useAnimatedRemoval } from "@/hooks/useAnimatedRemoval";
import { ProductGridSkeleton, LoadingSpinner } from "@/components/ui/loading";
import {
  LIST_ITEM_TRANSITION,
  LIST_ITEM_VARIANTS,
} from "@/lib/motion/list-removal";
import { confirm, toast } from "@/lib/feedback";
import { createEventId, trackLocalCartAddition } from "@/lib/analytics/meta-pixel";

type WishlistView = "grid" | "list";

type WishlistSort =
  | "recent"
  | "oldest"
  | "price-asc"
  | "price-desc"
  | "rating";

export default function WishlistPage() {
  const i18n = useInterfaceTranslations("InterfaceWishlistPage");
  const { pricingReady } = useCurrency();
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { data: session, status } = useSession();

  const items = useSelector((state: RootState) => state.wishlist.items);
  const mode = useSelector((state: RootState) => state.wishlist.mode);
  const isLoading = useSelector((state: RootState) => state.wishlist.isLoading);
  const error = useSelector((state: RootState) => state.wishlist.error);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<WishlistSort>("recent");
  const [view, setView] = useState<WishlistView>("grid");
  const [activeCategory, setActiveCategory] = useState("all");
  const itemsRef = useRef(items);

  // Saved-for-later items are shared with the cart page via localStorage.
  const [saved, setSaved] = useState<SavedItem[]>(() => readLocalSaved());

  const canUseServer =
    status === "authenticated" && isServerWishlistRole(session?.user?.role);

  const {
    visibleItems: visibleWishlistRows,
    queueRemoval: queueWishlistRemoval,
    queueBatchRemoval: queueWishlistBatchRemoval,
  } = useAnimatedRemoval({
    items,
    getId: (item) => item.id,
  });

  const {
    visibleItems: visibleSavedItems,
    queueRemoval: queueSavedRemoval,
  } = useAnimatedRemoval({
    items: saved,
    getId: (item) => item.id,
  });

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const categories = useMemo(
    () => Array.from(new Set(visibleWishlistRows.map((item) => item.category))),
    [visibleWishlistRows],
  );

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    let next = visibleWishlistRows.filter((item) => {
      const matchesCategory =
        activeCategory === "all" || item.category === activeCategory;
      const matchesQuery =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });

    next = [...next].sort((a, b) => {
      switch (sort) {
        case "recent":
          return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
        case "oldest":
          return new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime();
        case "price-asc":
          return a.price - b.price;
        case "price-desc":
          return b.price - a.price;
        case "rating":
          return b.rating - a.rating;
        default:
          return 0;
      }
    });

    return next;
  }, [activeCategory, query, sort, visibleWishlistRows]);

  const stats = useMemo(() => {
    const totalValue = items.reduce((sum, item) => sum + item.price, 0);
    const totalSavings = items.reduce(
      (sum, item) =>
        sum + (item.originalPrice ? Math.max(0, item.originalPrice - item.price) : 0),
      0,
    );
    const priceDrops = items.filter(
      (item) =>
        typeof item.priceDropFromAdded === "number" && item.priceDropFromAdded > 0,
    ).length;

    return { totalValue, totalSavings, priceDrops };
  }, [items]);

  const allVisibleSelected =
    visibleItems.length > 0 && visibleItems.every((item) => selected.has(item.id));

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(visibleItems.map((item) => item.id)));
    }
  };

  const clearSelection = () => setSelected(new Set());

  const removeSelection = (ids: string[]) => {
    if (ids.length === 0) return;
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  };

  const commitWishlistRemoval = async (
    ids: string[],
    successMessage?: string,
  ) => {
    if (ids.length === 0) return;

    dispatch(setWishlistError(null));

    if (canUseServer) {
      try {
        await Promise.all(ids.map((id) => removeWishlistItemOnServer(id)));
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Failed to update wishlist on server.";
        dispatch(setWishlistError(message));
        throw new Error(message);
      }
    }

    const idSet = new Set(ids);
    const next = itemsRef.current.filter((item) => !idSet.has(item.id));
    dispatch(setWishlistItems(next));
    writeLocalWishlist(next);

    if (successMessage) {
      toast.success(i18n(successMessage));
    }
  };

  const handleRemove = (id: string) => {
    removeSelection([id]);
    queueWishlistRemoval(
      id,
      async () => {
        await commitWishlistRemoval([id], "Removed from wishlist");
      },
      (error) => {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to update wishlist on server.";
        toast.error(i18n(message));
      },
    );
  };

  const handleRemoveSelected = async () => {
    const count = selected.size;
    if (count === 0) return;

    const ok = await confirm({
      title: `Remove ${count} item${count > 1 ? "s" : ""}?`,
      description: `This will remove ${count} selected item${count > 1 ? "s" : ""} from your wishlist.`,
      confirmLabel: "Remove",
      variant: "danger",
    });
    if (!ok) return;

    const ids = Array.from(selected);
    removeSelection(ids);
    queueWishlistBatchRemoval(
      ids,
      async (batchIds) => {
        await commitWishlistRemoval(
          batchIds,
          `${batchIds.length} item${batchIds.length > 1 ? "s" : ""} removed from wishlist`,
        );
      },
      (error) => {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to update wishlist on server.";
        toast.error(i18n(message));
      },
    );
  };

  const moveItemsToCart = async (itemIds: string[]) => {
    const selectedInStock = items.filter(
      (item) => itemIds.includes(item.id) && item.inStock,
    );
    if (selectedInStock.length === 0) return;

    // Products with multiple variants need a size/color choice — they
    // can't be blindly added. Route a lone item to its page; for a mixed
    // batch, add the single-variant items and nudge the rest.
    const needsSelection = selectedInStock.filter(
      (item) => (item.variantCount ?? 1) > 1,
    );
    const toMove = selectedInStock.filter(
      (item) => (item.variantCount ?? 1) <= 1,
    );

    if (needsSelection.length > 0) {
      if (selectedInStock.length === 1) {
        const target = needsSelection[0];
        router.push(`/products/${target.slug ?? target.id}`);
        return;
      }
      toast.info(
        i18n("Some items need a size or color — open them to choose options."),
      );
      if (toMove.length === 0) return;
    }

    dispatch(setCartErrorAction(null));

    if (canUseServer) {
      try {
        await Promise.all(toMove.map((item) => addCartItemOnServer(item.id)));
        const snapshot = await fetchServerCartSnapshot();
        writeLocalCart(snapshot.items);
        dispatch(setCartData(snapshot));
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to move item to cart.";
        dispatch(setCartErrorAction(message));
        toast.error(i18n(message));
        return;
      }

      const removeIds = toMove.map((item) => item.id);
      removeSelection(removeIds);
      queueWishlistBatchRemoval(
        removeIds,
        async (batchIds) => {
          await commitWishlistRemoval(batchIds);
          toast.success(
            i18n(toMove.length === 1
              ? `${toMove[0].name} moved to cart`
              : `${toMove.length} items moved to cart`),
          );
        },
        (error) => {
          const message =
            error instanceof Error
              ? error.message
              : "Failed to update wishlist on server.";
          toast.error(i18n(message));
        },
      );
      return;
    }

    const localBefore = readLocalCart();
    const optimistic = toMove.reduce((acc, item) => {
      return upsertLocalCartItem(acc, {
        id: `local:${item.id}`,
        productId: item.id,
        productCode: item.productCode,
        name: item.name,
        image: item.image,
        quantity: 1,
        unitPrice: item.price,
        originalPrice: item.originalPrice ?? item.price,
        lineTotal: item.price,
        stock: 10,
        status: "ACTIVE",
      });
    }, localBefore);

    writeLocalCart(optimistic);
    dispatch(setCartData({ items: optimistic, summary: computeCartSummary(optimistic) }));
    if (pricingReady !== false) trackLocalCartAddition(localBefore, optimistic, createEventId());

    const removeIds = toMove.map((item) => item.id);
    removeSelection(removeIds);
    queueWishlistBatchRemoval(
      removeIds,
      async (batchIds) => {
        await commitWishlistRemoval(batchIds);
        toast.success(
          i18n(toMove.length === 1
            ? `${toMove[0].name} moved to cart`
            : `${toMove.length} items moved to cart`),
        );
      },
      (error) => {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to update wishlist on server.";
        toast.error(i18n(message));
      },
    );
  };

  const handleMoveToCart = (id: string) => {
    void moveItemsToCart([id]);
  };

  const handleMoveSelectedToCart = () => {
    const ids = Array.from(selected).filter((id) => {
      const item = items.find((entry) => entry.id === id);
      return item?.inStock;
    });
    void moveItemsToCart(ids);
  };

  const handleShare = async (id: string) => {
    if (typeof window === "undefined") return;

    const url = `${window.location.origin}/products/${id}`;
    const shareData: ShareData = {
      title: i18n("Check this out"),
      url,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // user cancelled
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      toast.info(i18n("Link copied to clipboard"));
    } catch {
      console.info("Share link:", url);
    }
  };

  const clearFilters = () => {
    setQuery("");
    setActiveCategory("all");
  };

  const isFiltered = query.trim() !== "" || activeCategory !== "all";

  // ── Saved-for-later handlers ──────────────────────────────────────────
  const removeSavedFromLocal = (id: string) => {
    setSaved((prev) => {
      const next = prev.filter((item) => item.id !== id);
      writeLocalSaved(next);
      return next;
    });
  };

  const handleSavedRemove = (id: string) => {
    queueSavedRemoval(id, () => {
      removeSavedFromLocal(id);
      toast.success(i18n("Removed from saved items"));
    });
  };

  const handleSavedMoveToCart = (id: string) => {
    const target = saved.find((item) => item.id === id);
    if (!target || !target.inStock) return;
    const cartEventId = createEventId();

    const canUseServerCart =
      status === "authenticated" && isServerWishlistRole(session?.user?.role);

    queueSavedRemoval(
      id,
      async () => {
        if (canUseServerCart) {
          dispatch(setCartErrorAction(null));
          try {
            await addCartItemOnServer(target.productId, 1, target.variantId, cartEventId);
            const snapshot = await fetchServerCartSnapshot();
            writeLocalCart(snapshot.items);
            dispatch(setCartData(snapshot));
          } catch (err) {
            const message =
              err instanceof Error ? err.message : "Failed to move item to cart.";
            dispatch(setCartErrorAction(message));
            throw new Error(message);
          }
        } else {
          const localBefore = readLocalCart();
          const next = upsertLocalCartItem(localBefore, {
            id: `local:${target.variantId ?? target.productId}`,
            productId: target.productId,
            productCode: target.productCode,
            variantId: target.variantId ?? null,
            sku: target.sku ?? null,
            color: target.color ?? null,
            size: target.size ?? null,
            name: target.name,
            image: target.image,
            quantity: 1,
            unitPrice: target.price,
            originalPrice: target.originalPrice ?? target.price,
            lineTotal: target.price,
            stock: 10,
            status: "ACTIVE",
          });
          writeLocalCart(next);
          dispatch(setCartData({ items: next, summary: computeCartSummary(next) }));
          if (pricingReady !== false) trackLocalCartAddition(localBefore, next, cartEventId);
        }

        removeSavedFromLocal(id);
        toast.success(i18n(`${target.name} moved to cart`));
      },
      (error) => {
        const message =
          error instanceof Error ? error.message : "Failed to move item to cart.";
        toast.error(i18n(message));
      },
    );
  };

  if (pricingReady === false) return <PricingUnavailable />;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <WishlistHero
          totalItems={items.length}
          totalValue={stats.totalValue}
          totalSavings={stats.totalSavings}
          priceDrops={stats.priceDrops}
        />

        <div className="mt-2 flex items-center justify-between px-1 text-xs text-muted-foreground">
          <span>{i18n("Storage mode: {mode}", { mode: mode === "server" ? i18n("Server + Local") : i18n("Local only") })}</span>
          {isLoading && (
            <span className="inline-flex items-center gap-1.5">
              <LoadingSpinner decorative size="xs" />
              {i18n("Syncing wishlist...")}</span>
          )}
        </div>

        {error && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {i18n(error)}
          </div>
        )}

        {items.length > 0 && (
          <WishlistToolbar
            query={query}
            onQueryChange={setQuery}
            sort={sort}
            onSortChange={setSort}
            view={view}
            onViewChange={setView}
            categories={categories}
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            totalCount={items.length}
            visibleCount={visibleItems.length}
            allSelected={allVisibleSelected}
            onToggleSelectAll={toggleSelectAll}
          />
        )}

        <section className="mt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:pb-24">
          {isLoading && items.length === 0 ? (
            <ProductGridSkeleton count={8} />
          ) : items.length === 0 ? (
            <EmptyWishlist />
          ) : visibleItems.length === 0 ? (
            <EmptyWishlist filtered={isFiltered} onClearFilters={clearFilters} />
          ) : (
            <div
              className={
                view === "grid"
                  ? "grid grid-cols-2 gap-2 min-[360px]:gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4"
                  : "flex flex-col gap-3"
              }
            >
              <AnimatePresence initial={false} mode="popLayout">
                {visibleItems.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    variants={LIST_ITEM_VARIANTS}
                    transition={LIST_ITEM_TRANSITION}
                    className="overflow-hidden"
                  >
                    <WishlistCard
                      item={item}
                      view={view}
                      selected={selected.has(item.id)}
                      onToggleSelect={toggleSelect}
                      onRemove={handleRemove}
                      onMoveToCart={handleMoveToCart}
                      onShare={handleShare}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>

        {/* Saved for later — always visible, shared with the cart page */}
        {visibleSavedItems.length > 0 && (
          <SavedForLater
            items={visibleSavedItems}
            onMoveToCart={handleSavedMoveToCart}
            onRemove={handleSavedRemove}
          />
        )}
      </div>

      <BulkActionsBar
        selectedCount={selected.size}
        onClear={clearSelection}
        onMoveAllToCart={handleMoveSelectedToCart}
        onRemoveAll={() => { void handleRemoveSelected(); }}
      />
    </main>
  );
}
