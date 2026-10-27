"use client";
import { useCurrency } from "@/components/currency/CurrencyProvider";
import { useLocaleDraft, useLocaleSwitchGuard } from "@/components/i18n/useLocaleDraft";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { useCallback, useMemo, useState, useTransition } from "react";
import { Check, Heart, Minus, Plus, ShoppingCart, Zap } from "lucide-react";
import { useRouter } from "@/lib/i18n/navigation";
import { useDispatch, useSelector } from "react-redux";

import { ButtonLoader } from "@/components/ui/loading";
import CurrencyAmount from "@/components/currency/CurrencyAmount";
import {
  canUseServerCart,
  createCartItemOnServer,
  fetchServerCartSnapshot,
  type CartItem,
} from "@/features/cart/api";
import {
  readLocalCart,
  upsertLocalCartItem,
  writeLocalCart,
} from "@/features/cart/storage";
import { computeCartSummary } from "@/features/cart/summary";
import {
  canUseServerWishlist,
  createWishlistItemOnServer,
  removeWishlistItemOnServer,
  type WishlistItem,
} from "@/features/wishlist/api";
import {
  readLocalWishlist,
  upsertLocalWishlistItem,
  writeLocalWishlist,
} from "@/features/wishlist/storage";
import { useSession } from "@/lib/auth/use-app-session";
import { toast } from "@/lib/feedback";
import { createEventId, trackLocalCartAddition } from "@/lib/analytics/meta-pixel";
import { type AppDispatch, type RootState } from "@/store";
import {
  setCartData,
  setCartError as setCartErrorAction,
} from "@/store/slices/cart.slice";
import {
  removeWishlistItem,
  setWishlistError,
  upsertWishlistItem,
} from "@/store/slices/wishlist.slice";

import { initialVariantSelectionId } from "./variant-selection";

const FALLBACK_PRODUCT_IMAGE =
  "https://images.unsplash.com/photo-1542838132-92c53300491e?w=400";
const PRODUCT_VARIANT_IMAGE_EVENT = "SexToy:product-variant-image";
const HEX_VALUE = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export type ProductVariantOption = {
  id: string;
  variantKey: string;
  name: string | null;
  modelNumber: string | null;
  sku: string | null;
  color: string | null;
  size: string | null;
  attributes: Record<string, string> | null;
  stock: number;
  image: string | null;
  isActive: boolean;
};

type DisplayOption = {
  key: string;
  value: string;
};

function colorIsHex(value: string | null): boolean {
  return typeof value === "string" && HEX_VALUE.test(value.trim());
}

function normalizedOptionKey(value: string): string {
  return value.trim().toLocaleLowerCase();
}

/**
 * Size and color remain convenient shortcuts in the schema, but are exposed
 * through the same UI as every arbitrary key/value variant attribute.
 */
function variantDisplayOptions(variant: ProductVariantOption): DisplayOption[] {
  const options = new Map<string, DisplayOption>();

  for (const [rawKey, rawValue] of Object.entries(variant.attributes ?? {})) {
    const key = rawKey.trim();
    const value = rawValue.trim();
    if (!key || !value) continue;
    options.set(normalizedOptionKey(key), { key, value });
  }

  if (variant.color?.trim() && !options.has("color")) {
    options.set("color", { key: "Color", value: variant.color.trim() });
  }
  if (variant.size?.trim() && !options.has("size")) {
    options.set("size", { key: "Size", value: variant.size.trim() });
  }

  return [...options.values()];
}

function variantLabel(variant: ProductVariantOption): string {
  const name = variant.name?.trim();
  if (name) return name;

  const values = variantDisplayOptions(variant).map((option) => option.value);
  if (values.length > 0) return values.join(" / ");

  return (
    variant.modelNumber?.trim() || variant.sku?.trim() || "Standard option"
  );
}

function genericAttributeSummary(
  attributes: Record<string, string> | null,
): string | null {
  const summary = Object.entries(attributes ?? {})
    .map(([key, value]) => `${key}: ${value}`)
    .join(" · ");
  return summary || null;
}

type ProductActionsProps = {
  productId: string;
  productCode?: string | null;
  productSlug: string;
  productName: string;
  image?: string | null;
  category: string;
  rating: number;
  reviewCount: number;
  variants: ProductVariantOption[];
  /** Regular selling price (product-level). */
  salePrice: number;
  /** Optional discounted price; when set it's the price the customer pays. */
  discountPrice: number | null;
};

const ProductActions = ({
  productId,
  productCode,
  productSlug,
  productName,
  image,
  category,
  rating,
  reviewCount,
  variants,
  salePrice,
  discountPrice,
}: ProductActionsProps) => {
  const i18n = useInterfaceTranslations("InterfaceProductsSlugComponentsProductActions");
  const { pricingReady } = useCurrency();
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { data: session, status } = useSession();

  const activeVariants = useMemo(
    () => variants.filter((variant) => variant.isActive),
    [variants],
  );
  const hasMultipleVariants = activeVariants.length > 1;
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    () => initialVariantSelectionId(variants),
  );
  const [quantity, setQuantity] = useState(1);
  const [isCartBusy, setIsCartBusy] = useState(false);
  const [isWishlistBusy, setIsWishlistBusy] = useState(false);
  const [isBuyNowPending, startBuyNowTransition] = useTransition();
  useLocaleSwitchGuard(isCartBusy || isWishlistBusy || isBuyNowPending);
  const selectionDraft = { selectedVariantId: selectedVariantId ?? "", quantity };
  useLocaleDraft("product-options:" + productId, selectionDraft, (update) => {
    const next = typeof update === "function" ? update(selectionDraft) : update;
    const variant = activeVariants.find((entry) => entry.id === next.selectedVariantId);
    if (variant) {
      setSelectedVariantId(variant.id);
      if (Number.isFinite(next.quantity)) setQuantity(Math.max(1, Math.min(Math.max(1, variant.stock), Math.round(next.quantity))));
    }
  }, ["selectedVariantId", "quantity"]);
  const isWishlisted = useSelector((state: RootState) =>
    state.wishlist.items.some((item) => item.id === productId),
  );

  const selectedVariant =
    activeVariants.find((variant) => variant.id === selectedVariantId) ?? null;
  const stockCount = selectedVariant?.stock ?? 0;
  const isPurchasable = selectedVariant != null && stockCount > 0;
  const currentListPrice = salePrice;
  const unitPrice =
    discountPrice != null && discountPrice < salePrice
      ? discountPrice
      : salePrice;
  const discount =
    currentListPrice > unitPrice
      ? Math.round(((currentListPrice - unitPrice) / currentListPrice) * 100)
      : 0;

  const notifyVariantImageChange = useCallback(
    (variant: ProductVariantOption | null) => {
      window.dispatchEvent(
        new CustomEvent(PRODUCT_VARIANT_IMAGE_EVENT, {
          detail: {
            productId,
            variantId: variant?.id ?? null,
            image: variant?.image ?? null,
          },
        }),
      );
    },
    [productId],
  );

  const selectVariant = (variant: ProductVariantOption) => {
    setSelectedVariantId(variant.id);
    setQuantity(1);
    notifyVariantImageChange(variant);
  };

  const handleQuantityChange = (delta: number) => {
    setQuantity((current) =>
      Math.max(1, Math.min(stockCount || 1, current + delta)),
    );
  };

  const handleAddToCart = async () => {
    if (pricingReady === false) return;
    if (!isPurchasable || isCartBusy || !selectedVariant) return;

    const canUseServer = canUseServerCart(session?.user?.role, status);
    dispatch(setCartErrorAction(null));

    if (canUseServer) {
      setIsCartBusy(true);
      try {
        await createCartItemOnServer(productId, quantity, selectedVariant.id);
        const snapshot = await fetchServerCartSnapshot();
        writeLocalCart(snapshot.items);
        dispatch(setCartData(snapshot));
        toast.success(i18n(`${productName} added to cart`));
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to add item to cart.";
        dispatch(setCartErrorAction(message));
        toast.error(i18n(message));
      } finally {
        setIsCartBusy(false);
      }
      return;
    }

    const localBefore = readLocalCart();
    const optimisticItem: CartItem = {
      id: `local:${selectedVariant.id}`,
      productId,
      productCode,
      slug: productSlug,
      variantId: selectedVariant.id,
      variantName: selectedVariant.name,
      sku: selectedVariant.sku,
      color: selectedVariant.color,
      size: selectedVariant.size,
      attributes: selectedVariant.attributes,
      attributeSummary: genericAttributeSummary(selectedVariant.attributes),
      name: productName,
      image: selectedVariant.image ?? image ?? FALLBACK_PRODUCT_IMAGE,
      quantity,
      unitPrice,
      originalPrice: currentListPrice,
      lineTotal: unitPrice * quantity,
      stock: stockCount,
      status: "ACTIVE",
    };

    const nextLocal = upsertLocalCartItem(localBefore, optimisticItem);
    writeLocalCart(nextLocal);
    dispatch(
      setCartData({
        items: nextLocal,
        summary: computeCartSummary(nextLocal),
      }),
    );
    toast.success(i18n(`${productName} added to cart`));
    trackLocalCartAddition(localBefore, nextLocal, createEventId());
  };

  const handleBuyNow = () => {
    if (pricingReady === false) return;
    if (!isPurchasable || !selectedVariant || isBuyNowPending) return;
    const target = `/checkout?buy=${encodeURIComponent(
      `${productId}:${quantity}:${selectedVariant.id}`,
    )}`;
    const nextHref = target;
    startBuyNowTransition(() => {
      router.push(nextHref);
    });
  };

  const handleToggleWishlist = async () => {
    if (pricingReady === false) return;
    if (isWishlistBusy) return;

    const canUseServer = canUseServerWishlist(session?.user?.role, status);
    const localBefore = readLocalWishlist();
    const optimisticItem: WishlistItem = {
      id: productId,
      productCode,
      slug: productSlug,
      name: productName,
      image: image ?? FALLBACK_PRODUCT_IMAGE,
      price: unitPrice,
      originalPrice: discount > 0 ? currentListPrice : undefined,
      rating,
      reviewCount,
      category: category.trim() || "General",
      inStock: activeVariants.some((variant) => variant.stock > 0),
      addedAt: new Date().toISOString(),
      variantCount: activeVariants.length,
    };

    dispatch(setWishlistError(null));

    if (isWishlisted) {
      const nextLocal = localBefore.filter((item) => item.id !== productId);
      writeLocalWishlist(nextLocal);
      dispatch(removeWishlistItem(productId));
      toast.success(i18n("Removed from wishlist"));

      if (!canUseServer) return;

      setIsWishlistBusy(true);
      try {
        await removeWishlistItemOnServer(productId);
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
        setIsWishlistBusy(false);
      }
      return;
    }

    const nextLocal = upsertLocalWishlistItem(localBefore, optimisticItem);
    writeLocalWishlist(nextLocal);
    dispatch(upsertWishlistItem(optimisticItem));
    toast.success(i18n("Added to wishlist"));

    if (!canUseServer) return;

    setIsWishlistBusy(true);
    try {
      const savedItem = await createWishlistItemOnServer(productId);
      const latestLocal = upsertLocalWishlistItem(
        readLocalWishlist(),
        savedItem,
      );
      writeLocalWishlist(latestLocal);
      dispatch(upsertWishlistItem(savedItem));
    } catch (error) {
      writeLocalWishlist(localBefore);
      dispatch(removeWishlistItem(productId));
      const message =
        error instanceof Error
          ? error.message
          : "Failed to add item to wishlist.";
      dispatch(setWishlistError(message));
      toast.error(i18n(message));
    } finally {
      setIsWishlistBusy(false);
    }
  };

  return (
    <div className="min-w-0 space-y-5 border-t border-border pt-4">
      <div className="flex min-w-0 flex-wrap items-baseline gap-3">
        <CurrencyAmount
          amountUSD={unitPrice}
          className="max-w-full text-3xl font-bold tabular-nums text-foreground [overflow-wrap:anywhere]"
        />
        {discount > 0 && (
          <>
            <CurrencyAmount
              amountUSD={currentListPrice}
              className="text-lg text-body line-through"
            />
            <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-primary">
              -{discount}%
            </span>
          </>
        )}
      </div>

      {hasMultipleVariants && (
        <fieldset
          className="min-w-0 space-y-2"
          aria-describedby="variant-selection-help"
        >
          <legend className="text-sm font-semibold text-foreground">
            {i18n("Choose an option")}</legend>
          <p id="variant-selection-help" className="sr-only">
            {i18n("The first option is selected by default. Choose another available combination if you prefer.")}</p>
          <div className="flex min-w-0 flex-wrap gap-2">
            {activeVariants.map((variant) => {
              const isSelected = variant.id === selectedVariant?.id;
              const isOutOfStock = variant.stock <= 0;
              const options = variantDisplayOptions(variant);
              const colorOption = options.find(
                (option) => normalizedOptionKey(option.key) === "color",
              );
              const variantName = variant.name?.trim();
              const combinationOptions = variantName
                ? options.filter(
                    (option) =>
                      normalizedOptionKey(option.key) !== "color" ||
                      (!colorIsHex(option.value) &&
                        normalizedOptionKey(option.value) !==
                          normalizedOptionKey(variantName)),
                  )
                : [];

              return (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => selectVariant(variant)}
                  disabled={isOutOfStock}
                  aria-pressed={isSelected}
                  aria-label={[
                    variantLabel(variant),
                    ...options.map((option) => `${option.key}: ${option.value}`),
                    ...(isOutOfStock ? ["Out of stock"] : []),
                  ].join(", ")}
                  className={`inline-flex min-h-11 min-w-0 max-w-full items-center gap-2 rounded-xl border px-3 py-2 text-start transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-ring"
                      : isOutOfStock
                        ? "cursor-not-allowed border-border bg-background opacity-60"
                        : "border-border bg-card hover:border-primary/70 hover:bg-primary/5"
                  }`}
                >
                  {colorOption && colorIsHex(colorOption.value) && (
                    <span
                      className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-inset ring-black/20"
                      style={{ backgroundColor: colorOption.value }}
                      aria-hidden="true"
                    />
                  )}
                  <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 [overflow-wrap:anywhere]">
                    <span className="min-w-0 text-[13px] font-semibold leading-5 text-foreground">
                      {variantLabel(variant)}
                    </span>
                    {combinationOptions.map((option) => (
                      <span
                        key={`${variant.id}:${option.key}`}
                        className="min-w-0 text-[11px] leading-4 text-muted-foreground"
                      >
                        {option.key}: {option.value}
                      </span>
                    ))}
                    {isOutOfStock && (
                      <span className="text-[11px] font-medium leading-4 text-destructive">
                        {i18n("Out of stock")}</span>
                    )}
                  </span>
                  <Check
                    className={`h-3.5 w-3.5 shrink-0 text-primary ${
                      isSelected ? "opacity-100" : "opacity-0"
                    }`}
                    aria-hidden="true"
                  />
                </button>
              );
            })}
          </div>
          {selectedVariant && (
            <div
              className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] leading-4 text-muted-foreground [overflow-wrap:anywhere]"
              aria-live="polite"
            >
              {variantDisplayOptions(selectedVariant).map((option) => (
                <span key={option.key} className="min-w-0">
                  {option.key}: {option.value}
                </span>
              ))}
              {(selectedVariant.modelNumber || selectedVariant.sku) && (
                <span className="min-w-0">
                  {[selectedVariant.modelNumber, selectedVariant.sku]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              )}
              <span
                className={`font-medium ${
                  isPurchasable ? "text-emerald-700" : "text-destructive"
                }`}
              >
                {isPurchasable ? i18n("{value0} available", { value0: stockCount }) : i18n("Out of stock")}
              </span>
            </div>
          )}
        </fieldset>
      )}

      {activeVariants.length === 1 &&
        selectedVariant &&
        variantDisplayOptions(selectedVariant).length > 0 && (
          <div className="rounded-xl border border-border bg-background p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {i18n("Included option")}</p>
            <dl className="mt-2 flex min-w-0 flex-wrap gap-x-5 gap-y-2 text-sm">
              {variantDisplayOptions(selectedVariant).map((option) => (
                <div
                  key={option.key}
                  className="flex min-w-0 max-w-full flex-wrap gap-1.5 [overflow-wrap:anywhere]"
                >
                  <dt className="min-w-0 text-muted-foreground [overflow-wrap:anywhere]">
                    {option.key}:
                  </dt>
                  <dd className="min-w-0 font-medium text-foreground [overflow-wrap:anywhere]">
                    {option.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}

      <p
        className="text-xs font-medium text-muted-foreground [overflow-wrap:anywhere]"
        aria-live="polite"
      >
        {activeVariants.length === 0 ? (
          <span className="text-destructive">
            {i18n("This product is currently unavailable.")}</span>
        ) : hasMultipleVariants && !selectedVariant ? (
          i18n("Choose an option combination to see its availability.")
        ) : isPurchasable ? (
          <>
            <span className="text-emerald-700">{i18n("In stock")}</span>
            {stockCount <= 5 && (
              <span className="ms-1 text-amber-600">
                {i18n("· only {count, number} left", { count: stockCount })}</span>
            )}
          </>
        ) : (
          <span className="text-destructive">{i18n("Out of stock")}</span>
        )}
      </p>

      <div className="grid grid-cols-1 items-center gap-2 min-[360px]:grid-cols-[auto_minmax(0,1fr)]">
        <div className="flex w-fit items-center overflow-hidden rounded-xl border border-border">
          <button
            type="button"
            onClick={() => handleQuantityChange(-1)}
            disabled={!isPurchasable || quantity <= 1}
            aria-label={i18n("Decrease quantity")}
            className="flex h-11 w-11 items-center justify-center transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Minus className="h-4 w-4 text-body" />
          </button>
          <span className="w-11 text-center font-medium text-foreground">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => handleQuantityChange(1)}
            disabled={!isPurchasable || quantity >= stockCount}
            aria-label={i18n("Increase quantity")}
            className="flex h-11 w-11 items-center justify-center transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4 text-body" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            void handleAddToCart();
          }}
          title={pricingReady === false ? "Prices are temporarily unavailable" : undefined}
          disabled={pricingReady === false || !isPurchasable || isCartBusy}
          aria-busy={isCartBusy}
          className={`flex min-h-11 min-w-0 w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:px-6 ${
            isPurchasable
              ? "border border-primary bg-card text-primary hover:bg-secondary"
              : "cursor-not-allowed bg-muted text-muted-foreground"
          }`}
        >
          {isCartBusy ? (
            <ButtonLoader label={i18n("Adding...")} />
          ) : (
            <>
              <ShoppingCart className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {hasMultipleVariants && !selectedVariant
                  ? i18n("Select an option")
                  : i18n("Add to cart")}
              </span>
            </>
          )}
        </button>
      </div>

      <button
        type="button"
        onClick={handleBuyNow}
        title={pricingReady === false ? "Prices are temporarily unavailable" : undefined}
          disabled={pricingReady === false || !isPurchasable || isBuyNowPending}
        aria-busy={isBuyNowPending}
        className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
          isPurchasable
            ? "bg-primary text-primary-foreground hover:bg-primary-hover"
            : "cursor-not-allowed bg-muted text-muted-foreground"
        }`}
      >
        {isBuyNowPending ? (
          <ButtonLoader label={i18n("Preparing checkout...")} />
        ) : (
          <>
            <Zap className="h-4 w-4" />
            {i18n("Buy now")}</>
        )}
      </button>

      <div className="fixed inset-x-0 bottom-0 z-60 border-t border-border bg-card/95 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.2)] backdrop-blur-lg lg:hidden sm:px-4 sm:pt-3">
          <div className="mx-auto flex max-w-2xl items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => {
                void handleToggleWishlist();
              }}
              title={pricingReady === false ? "Prices are temporarily unavailable" : undefined}
          disabled={pricingReady === false || isWishlistBusy}
              aria-label={
                isWishlisted ? i18n("Remove from wishlist") : i18n("Add to wishlist")
              }
              aria-pressed={isWishlisted}
              aria-busy={isWishlistBusy}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition sm:h-12 sm:w-12 ${
                isWishlisted
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-body hover:border-primary/40 hover:text-primary"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {isWishlistBusy ? (
                <ButtonLoader />
              ) : (
                <Heart
                  className={`h-5 w-5 ${isWishlisted ? "fill-current" : ""}`}
                />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                void handleAddToCart();
              }}
              title={pricingReady === false ? "Prices are temporarily unavailable" : undefined}
          disabled={pricingReady === false || !isPurchasable || isCartBusy}
              aria-busy={isCartBusy}
              className="flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border border-primary bg-card px-2 text-xs font-bold text-primary transition hover:bg-primary/5 disabled:cursor-not-allowed disabled:border-border disabled:text-muted-foreground sm:h-12 sm:px-4 sm:text-sm"
            >
              {isCartBusy ? (
                <ButtonLoader label={i18n("Adding...")} />
              ) : (
                <>
                  <ShoppingCart className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {hasMultipleVariants && !selectedVariant
                      ? i18n("Select option")
                      : i18n("Add to cart")}
                  </span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleBuyNow}
              title={pricingReady === false ? "Prices are temporarily unavailable" : undefined}
          disabled={pricingReady === false || !isPurchasable || isBuyNowPending}
              aria-busy={isBuyNowPending}
              className="flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-2 text-xs font-bold text-primary-foreground shadow-sm transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground sm:h-12 sm:px-4 sm:text-sm"
            >
              {isBuyNowPending ? (
                <ButtonLoader label={i18n("Opening...")} />
              ) : (
                <>
                  <Zap className="h-4 w-4 shrink-0" />
                  <span className="truncate">{i18n("Buy now")}</span>
                </>
              )}
            </button>
          </div>
      </div>
    </div>
  );
};

export default ProductActions;
