"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { useEffect, useRef } from "react";
import Link from "@/lib/i18n/navigation";
import { ArrowRight, Heart, ShoppingBag, Trash2, Star } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useSession } from "@/lib/auth/use-app-session";
import { useDispatch, useSelector } from "react-redux";

import {
  isServerWishlistRole,
  removeWishlistItemOnServer,
} from "@/features/wishlist/api";
import { writeLocalWishlist } from "@/features/wishlist/storage";
import {
  setWishlistError,
  setWishlistItems,
} from "@/store/slices/wishlist.slice";
import type { AppDispatch, RootState } from "@/store";
import { CurrencyAmount } from "@/components/currency/CurrencyAmount";
import { toast } from "@/lib/feedback";
import { useAnimatedRemoval } from "@/hooks/useAnimatedRemoval";
import { ProductGridSkeleton } from "@/components/ui/loading";
import {
  LIST_ITEM_TRANSITION,
  LIST_ITEM_VARIANTS,
} from "@/lib/motion/list-removal";

import { FALLBACK_PRODUCT_IMAGE } from "./constants";

const PROFILE_PREVIEW_LIMIT = 6;

/**
 * Wishlist preview tab on the profile page.
 *
 * Consumes the wishlist hydrated by the root StoreHydrator. The full
 * management UX lives on /wishlist; this is the at-a-glance view.
 */
export default function WishlistTab() {
  const i18n = useInterfaceTranslations("InterfaceProfileComponentsWishlistTab");
  const dispatch = useDispatch<AppDispatch>();
  const { data: session, status } = useSession();

  const items = useSelector((state: RootState) => state.wishlist.items);
  const isLoading = useSelector((state: RootState) => state.wishlist.isLoading);
  const error = useSelector((state: RootState) => state.wishlist.error);
  const itemsRef = useRef(items);

  const canUseServer =
    status === "authenticated" && isServerWishlistRole(session?.user?.role);
  const { visibleItems, queueRemoval } = useAnimatedRemoval({
    items,
    getId: (item) => item.id,
  });

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const handleRemove = (id: string) => {
    queueRemoval(
      id,
      async () => {
        dispatch(setWishlistError(null));

        if (canUseServer) {
          try {
            await removeWishlistItemOnServer(id);
          } catch (err) {
            const message =
              err instanceof Error ? err.message : "Failed to remove from wishlist.";
            dispatch(setWishlistError(message));
            throw new Error(message);
          }
        }

        const next = itemsRef.current.filter((item) => item.id !== id);
        dispatch(setWishlistItems(next));
        writeLocalWishlist(next);
        toast.success(i18n("Removed from wishlist"));
      },
      (error) => {
        const message =
          error instanceof Error ? error.message : "Failed to remove from wishlist.";
        toast.error(i18n(message));
      },
    );
  };

  const previewItems = visibleItems.slice(0, PROFILE_PREVIEW_LIMIT);
  const hiddenCount = Math.max(0, items.length - PROFILE_PREVIEW_LIMIT);

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <header className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:rounded-3xl sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <Heart className="h-4 w-4 fill-current" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-foreground sm:text-lg">
                {i18n("Wishlist")}</h2>
              <p className="text-xs text-muted-foreground">
                {i18n("{count, plural, one {# saved item.} other {# saved items.}} Manage filters and bulk actions on the full wishlist page.", { count: items.length })}</p>
            </div>
          </div>
          <Link
            href="/wishlist"
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-primary transition-all duration-200 hover:-translate-y-0.5 hover:border-primary hover:bg-background sm:w-auto"
          >
            {i18n("Open wishlist")}<ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
          </Link>
        </div>
      </header>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {i18n(error)}
        </div>
      )}

      {isLoading && items.length === 0 ? (
        <ProductGridSkeleton count={6} />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm sm:rounded-3xl sm:p-10">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
            <Heart className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-lg font-bold text-foreground">
            {i18n("Your wishlist is empty")}</h3>
          <p className="mt-1 text-sm text-body">
            {i18n("Save products you love and they'll show up here.")}</p>
          <Link
            href="/products"
            className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-xl"
          >
            <ShoppingBag className="h-4 w-4" />
            {i18n("Discover products")}</Link>
        </div>
      ) : (
        <>
          <ul className="grid gap-3 @md:grid-cols-2 @3xl:grid-cols-3">
            <AnimatePresence initial={false} mode="popLayout">
              {previewItems.map((item) => (
                <motion.li
                  key={item.id}
                  layout
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  variants={LIST_ITEM_VARIANTS}
                  transition={LIST_ITEM_TRANSITION}
                  className="group flex gap-3 overflow-hidden rounded-2xl border border-border bg-card p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
                >
                <Link
                  href={`/products/${item.id}`}
                  className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-background min-[380px]:h-20 min-[380px]:w-20"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.image || FALLBACK_PRODUCT_IMAGE}
                    alt={item.name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {item.brand} • {item.category}
                  </p>
                  <Link
                    href={`/products/${item.id}`}
                    className="mt-0.5 line-clamp-2 text-sm font-bold text-foreground hover:text-primary"
                  >
                    {item.name}
                  </Link>
                  <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Star className="h-3 w-3 fill-brand-gold text-brand-gold" />
                    {item.rating.toFixed(1)} ({item.reviewCount})
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                    <p className="min-w-0 truncate text-xs font-bold text-primary min-[380px]:text-sm">
                      <CurrencyAmount amountUSD={item.price} />
                    </p>
                    <button
                      type="button"
                      onClick={() => handleRemove(item.id)}
                      aria-label={i18n("Remove from wishlist")}
                      className="grid h-8 w-8 place-items-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 transition-colors hover:bg-rose-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>

          {hiddenCount > 0 && (
            <Link
              href="/wishlist"
              className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border bg-card px-4 py-3 text-sm font-bold text-primary transition-colors hover:bg-background"
            >
              {i18n("View {count, plural, one {# more item} other {# more items}}", { count: hiddenCount })}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Link>
          )}
        </>
      )}
    </div>
  );
}
