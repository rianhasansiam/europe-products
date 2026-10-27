"use client";
import { useCurrency } from "@/components/currency/CurrencyProvider";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { Heart, ListFilter, ShoppingCart, Star } from "lucide-react";
import Image from "next/image";
import Link from "@/lib/i18n/navigation";
import { useRouter } from "@/lib/i18n/navigation";
import { useSession } from "@/lib/auth/use-app-session";
import {
  useState,
  useSyncExternalStore,
  type MouseEvent,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "@/lib/feedback";
import { LoadingSpinner } from "@/components/ui/loading";

import {
  removeWishlistItem,
  setWishlistError,
  upsertWishlistItem,
} from "@/store/slices/wishlist.slice";
import {
  setCartData,
  setCartError as setCartErrorAction,
} from "@/store/slices/cart.slice";
import type { AppDispatch, RootState } from "@/store";
import {
  canUseServerCart,
  createCartItemOnServer,
  fetchServerCartSnapshot,
} from "@/features/cart/api";
import { computeCartSummary } from "@/features/cart/summary";
import {
  DEFAULT_CART_STOCK,
  readLocalCart,
  upsertLocalCartItem,
  writeLocalCart,
} from "@/features/cart/storage";
import {
  canUseServerWishlist,
  createWishlistItemOnServer,
  removeWishlistItemOnServer,
} from "@/features/wishlist/api";
import {
  readLocalWishlist,
  upsertLocalWishlistItem,
  writeLocalWishlist,
} from "@/features/wishlist/storage";
import type { CartItem } from "@/features/cart/api";
import type { WishlistItem } from "@/features/wishlist/api";
import CurrencyAmount from "@/components/currency/CurrencyAmount";
import { createEventId, trackLocalCartAddition } from "@/lib/analytics/meta-pixel";

type ProductCardProps = {
  id: string;
  productCode?: string | null;
  slug?: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  rating?: number;
  reviewCount?: number;
  badge?: string;
  /**
   * Number of purchasable variants. When > 1, the customer must choose a
   * size/color, so "Add to cart" routes to the product page instead of a
   * blind quick-add. Defaults to 1 (single variant -> direct add).
   */
  variantCount?: number;
  /** Known catalog availability; omitted for historical callers. */
  inStock?: boolean;
  nameLocale?: string;
};

const subscribeToHydration = () => () => {};
const getHydratedSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

export default function ProductCard({
  id,
  productCode,
  slug,
  name,
  price,
  originalPrice,
  image,
  rating = 0,
  reviewCount = 0,
  badge,
  variantCount = 1,
  inStock,
  nameLocale,
}: ProductCardProps) {
  const i18n = useInterfaceTranslations("InterfaceProductProductCard");
  const { pricingReady } = useCurrency();
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isBusy, setIsBusy] = useState(false);
  const [isCartBusy, setIsCartBusy] = useState(false);

  const isWishlistedInStore = useSelector((state: RootState) =>
    state.wishlist.items.some((item) => item.id === id),
  );
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    getHydratedSnapshot,
    getServerHydrationSnapshot,
  );
  // The server store starts empty. Mask localStorage-backed Redux updates until
  // this card hydrates so a streamed card cannot receive different ARIA/icon
  // attributes from StoreHydrator midway through hydration.
  const isWishlisted = isHydrated && isWishlistedInStore;

  const discount = originalPrice
    ? Math.round(((originalPrice - price) / originalPrice) * 100)
    : 0;
  const requiresOptionSelection = variantCount > 1;

  // Prefer the SEO-friendly slug; fall back to id for callers that
  // haven't been threaded with a slug yet (the route resolves both).
  const productHref = `/products/${slug ?? id}`;

  const handleToggleWishlist = async () => {
    if (pricingReady === false) return;
    if (isBusy) return;

    const canUseServer = canUseServerWishlist(session?.user?.role, status);
    const localBefore = readLocalWishlist();
    const optimisticItem: WishlistItem = {
      id,
      productCode,
      slug,
      name,
      image,
      price,
      originalPrice,
      rating,
      reviewCount,
      category: "General",
      inStock: true,
      addedAt: new Date().toISOString(),
      badge,
      variantCount,
    };

    dispatch(setWishlistError(null));

    if (isWishlistedInStore) {
      const nextLocal = localBefore.filter((item) => item.id !== id);
      writeLocalWishlist(nextLocal);
      dispatch(removeWishlistItem(id));
      toast.success(i18n("Removed from wishlist"));

      if (!canUseServer) return;

      setIsBusy(true);
      try {
        await removeWishlistItemOnServer(id);
      } catch (error) {
        writeLocalWishlist(localBefore);
        dispatch(upsertWishlistItem(optimisticItem));
        const message =
          error instanceof Error
            ? error.message
            : "Failed to remove item from wishlist.";
        dispatch(setWishlistError(message));
        toast.error(i18n(message));
      } finally {
        setIsBusy(false);
      }
      return;
    }

    const nextLocal = upsertLocalWishlistItem(localBefore, optimisticItem);
    writeLocalWishlist(nextLocal);
    dispatch(upsertWishlistItem(optimisticItem));
    toast.success(i18n("Added to wishlist"));

    if (!canUseServer) return;

    setIsBusy(true);
    try {
      const savedItem = await createWishlistItemOnServer(id);
      const latestLocal = upsertLocalWishlistItem(readLocalWishlist(), savedItem);
      writeLocalWishlist(latestLocal);
      dispatch(upsertWishlistItem(savedItem));
    } catch (error) {
      writeLocalWishlist(localBefore);
      dispatch(removeWishlistItem(id));
      const message =
        error instanceof Error
          ? error.message
          : "Failed to add item to wishlist.";
      dispatch(setWishlistError(message));
      toast.error(i18n(message));
    } finally {
      setIsBusy(false);
    }
  };

  const handleAddToCart = async () => {
    if (pricingReady === false) return;
    if (isCartBusy) return;

    // Products with multiple size/color variants can't be blindly added —
    // send the customer to the product page to choose a variant.
    if (requiresOptionSelection) {
      router.push(productHref);
      return;
    }

    const canUseServer = canUseServerCart(session?.user?.role, status);

    dispatch(setCartErrorAction(null));

    if (canUseServer) {
      setIsCartBusy(true);
      try {
        await createCartItemOnServer(id);
        const snapshot = await fetchServerCartSnapshot();
        writeLocalCart(snapshot.items);
        dispatch(setCartData(snapshot));
        toast.success(i18n("Added to cart"));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to add item to cart.";
        dispatch(setCartErrorAction(message));
        toast.error(i18n(message));
      } finally {
        setIsCartBusy(false);
      }
      return;
    }

    const localBefore = readLocalCart();
    const optimisticItem: CartItem = {
      id: `local:${id}`,
      productId: id,
      productCode,
      name,
      image,
      quantity: 1,
      unitPrice: price,
      originalPrice: originalPrice ?? price,
      lineTotal: price,
      stock: DEFAULT_CART_STOCK,
      status: "ACTIVE",
    };

    const nextLocal = upsertLocalCartItem(localBefore, optimisticItem);
    writeLocalCart(nextLocal);
    dispatch(setCartData({ items: nextLocal, summary: computeCartSummary(nextLocal) }));
    if (inStock !== false && variantCount > 0) {
      trackLocalCartAddition(localBefore, nextLocal, createEventId());
    }
    toast.success(i18n("Added to cart"));
  };

  const handleWishlistClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    void handleToggleWishlist();
  };

  const handleCartClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    void handleAddToCart();
  };

  return (
    <div className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-primary/35 hover:shadow-md">
      <div className="relative aspect-4/3 shrink-0 overflow-hidden bg-background">
        <Link
          href={productHref}
          aria-label={i18n("View {value0}", { value0: name })}
          className="absolute inset-0 z-0"
        >
          <Image
            src={image}
            alt={name}
            fill
            className="object-cover transition-transform duration-300 motion-safe:group-hover:scale-[1.025]"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
          />
        </Link>

        {badge && (
          <span className="absolute start-2 top-2 z-10 max-w-[calc(100%-1rem)] truncate rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground sm:max-w-[calc(100%-3.75rem)]">
            {i18n(badge)}
          </span>
        )}

        {discount > 0 && !badge && (
          <span className="absolute start-2 top-2 z-10 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
            -{discount}%
          </span>
        )}

        <button
          type="button"
          onClick={handleWishlistClick}
          title={pricingReady === false ? "Prices are temporarily unavailable" : undefined}
          disabled={pricingReady === false || isBusy}
          aria-busy={isBusy}
          aria-label={isWishlisted ? i18n("Remove from wishlist") : i18n("Add to wishlist")}
          aria-pressed={isWishlisted}
          className="absolute end-2 top-2 z-20 hidden h-11 w-11 items-center justify-center rounded-xl border border-border bg-card/95 p-0 shadow-sm transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:can-hover:flex"
        >
          {isBusy ? (
            <LoadingSpinner decorative size="sm" className="text-primary" />
          ) : (
            <Heart
              className={`h-4 w-4 transition-all duration-300 ${
                isWishlisted
                  ? "scale-110 fill-primary text-primary"
                  : "text-muted-foreground hover:text-primary"
              }`}
            />
          )}
        </button>

        <button
          type="button"
          onClick={handleCartClick}
          title={pricingReady === false ? "Prices are temporarily unavailable" : undefined}
          disabled={pricingReady === false || isCartBusy}
          aria-busy={isCartBusy}
          aria-label={
            requiresOptionSelection ? i18n("Select product options") : i18n("Add to cart")
          }
          className="absolute bottom-2 left-1/2 z-20 hidden min-h-11 -translate-x-1/2 items-center justify-center gap-1.5 rounded-xl border border-border bg-card/95 px-4 py-2 text-sm font-semibold text-primary shadow-sm transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:can-hover:flex disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isCartBusy ? (
            <>
              <LoadingSpinner decorative size="sm" />
              <span>{i18n("Adding")}</span>
            </>
          ) : (
            <>
              {requiresOptionSelection ? (
                <ListFilter className="h-3.5 w-3.5" />
              ) : (
                <ShoppingCart className="h-3.5 w-3.5" />
              )}
              <span>
                {requiresOptionSelection ? i18n("Options") : i18n("Add")}
              </span>
            </>
          )}
        </button>
      </div>

      <div className="flex flex-1 flex-col p-3 sm:p-4">
        {rating > 0 && (
          <div className="mb-1 flex items-center gap-0.5">
            <div className="flex items-center">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-3 w-3 ${
                    i < Math.round(rating)
                      ? "fill-brand-gold text-brand-gold"
                      : "text-brand-border"
                  }`}
                />
              ))}
            </div>
            <span className="ms-0.5 text-[10px] text-muted-foreground">({reviewCount})</span>
          </div>
        )}

        <Link href={productHref} className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <h3 lang={nameLocale} dir="auto" className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-foreground [overflow-wrap:anywhere] transition-colors hover:text-primary">
            {name}
          </h3>
        </Link>

        <div className="mt-auto flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 pt-3">
          <CurrencyAmount
            amountUSD={price}
            className="max-w-full text-base font-bold tabular-nums text-foreground [overflow-wrap:anywhere]"
          />
          {originalPrice && originalPrice > price && (
            <CurrencyAmount
              amountUSD={originalPrice}
              className="max-w-full text-[11px] text-muted-foreground line-through [overflow-wrap:anywhere]"
            />
          )}
        </div>

        <div className="mt-3 flex items-center gap-2 border-t border-border pt-3 sm:can-hover:hidden">
          <button
            type="button"
            onClick={handleCartClick}
            title={pricingReady === false ? "Prices are temporarily unavailable" : undefined}
          disabled={pricingReady === false || isCartBusy}
            aria-busy={isCartBusy}
            aria-label={
              requiresOptionSelection ? i18n("Select product options") : i18n("Add to cart")
            }
            className="flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-xl bg-primary px-2 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="truncate">
              {isCartBusy
                ? i18n("Adding...")
                : requiresOptionSelection
                  ? i18n("Options")
                  : i18n("Add")}
            </span>
          </button>

          <button
            type="button"
            onClick={handleWishlistClick}
            title={pricingReady === false ? "Prices are temporarily unavailable" : undefined}
          disabled={pricingReady === false || isBusy}
            aria-busy={isBusy}
            aria-label={isWishlisted ? i18n("Remove from wishlist") : i18n("Add to wishlist")}
            aria-pressed={isWishlisted}
            className={`flex min-h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
              isWishlisted
                ? "border-primary/30 bg-secondary text-primary"
                : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-primary"
            }`}
          >
            {isBusy ? (
              <LoadingSpinner decorative size="sm" className="text-primary" />
            ) : (
              <Heart
                className={`h-4 w-4 transition-transform duration-200 ${
                  isWishlisted ? "scale-110 fill-current" : ""
                }`}
              />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
