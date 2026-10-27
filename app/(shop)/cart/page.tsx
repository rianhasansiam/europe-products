"use client";
import PricingUnavailable from "@/components/currency/PricingUnavailable";
import { useCurrency } from "@/components/currency/CurrencyProvider";
import { useLocaleDraft, useLocaleSwitchGuard } from "@/components/i18n/useLocaleDraft";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "@/lib/i18n/navigation";
import { useRouter } from "@/lib/i18n/navigation";
import { Check, Lock, Minus } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useSession } from "@/lib/auth/use-app-session";
import { useDispatch, useSelector } from "react-redux";

import { CurrencyAmount } from "@/components/currency/CurrencyAmount";
import CartHeader from "./components/CartHeader";
import CartItemCard from "./components/CartItemCard";
import EmptyCart from "./components/EmptyCart";
import FreeShippingBar from "./components/FreeShippingBar";
import OrderSummary from "./components/OrderSummary";
import SavedForLater from "./components/SavedForLater";
import {
  setCartData,
  setCartError,
} from "@/store/slices/cart.slice";
import type { AppDispatch, RootState } from "@/store";
import {
  addToCartOnServer,
  canUseServerCart,
  fetchServerCartSnapshot,
  removeCartItemOnServer,
  updateCartItemOnServer,
} from "@/features/cart/api";
import {
  fetchCheckoutPreview,
  type CheckoutPreview,
} from "@/features/checkout/api";
import {
  buildCartSelectionCheckoutHref,
  normalizeCheckoutPromoCode,
} from "@/features/checkout/promo";
import { computeCartSummary } from "@/features/cart/summary";
import {
  readLocalCart as readCartFromStorage,
  writeLocalCart,
  cartItemKey,
} from "@/features/cart/storage";
import type { CartItem } from "@/features/cart/api";
import {
  mergeCartItemWithCheckoutPreview,
  shouldShowCartBootstrap,
  toCanonicalCartSummary,
} from "@/features/cart/checkout-preview";
import {
  type SavedItem,
  readLocalSaved,
  writeLocalSaved,
} from "@/features/cart/saved-storage";
import { useAnimatedRemoval } from "@/hooks/useAnimatedRemoval";
import {
  LIST_ITEM_TRANSITION,
  LIST_ITEM_VARIANTS,
} from "@/lib/motion/list-removal";
import { confirm, toast } from "@/lib/feedback";
import { createEventId, trackLocalCartAddition } from "@/lib/analytics/meta-pixel";
import { ButtonLoader, LoadingSpinner, SectionLoader } from "@/components/ui/loading";

type AppliedPromo = {
  code: string;
  discountUSD: number;
  description: string | null;
};

const FALLBACK_PRODUCT_IMAGE =
  "https://images.unsplash.com/photo-1542838132-92c53300491e?w=400";
const QUANTITY_SYNC_DEBOUNCE_MS = 350;

type PendingQuantitySync = {
  timeoutId: ReturnType<typeof setTimeout>;
  version: number;
  rollbackItem: CartItem;
};

function readLocalCart(): CartItem[] {
  return readCartFromStorage({ dedupeByProductId: true });
}

function toSavedItem(item: CartItem): SavedItem {
  return {
    id: `saved:${item.variantId ?? item.productId}`,
    productId: item.productId,
    productCode: item.productCode,
    slug: item.slug ?? item.productId,
    variantId: item.variantId ?? null,
    sku: item.sku ?? null,
    variantName: item.variantName ?? null,
    color: item.color ?? null,
    size: item.size ?? null,
    attributes: item.attributes ?? null,
    attributeSummary: item.attributeSummary ?? null,
    name: item.name,
    image: item.image ?? FALLBACK_PRODUCT_IMAGE,
    price: item.unitPrice,
    originalPrice: item.originalPrice > item.unitPrice ? item.originalPrice : undefined,
    inStock: item.status === "ACTIVE" && item.stock > 0,
  };
}

function toCartViewModel(item: CartItem) {
  return {
    id: item.id,
    productId: item.productId,
    slug: item.slug ?? item.productId,
    name: item.name,
    image: item.image ?? FALLBACK_PRODUCT_IMAGE,
    price: item.unitPrice,
    originalPrice: item.originalPrice > item.unitPrice ? item.originalPrice : undefined,
    quantity: item.quantity,
    maxQuantity: Math.max(1, item.stock),
    color: item.color ?? undefined,
    size: item.size ?? undefined,
    variantName: item.variantName ?? undefined,
    attributeSummary: item.attributeSummary ?? undefined,
    inStock: item.status === "ACTIVE" && item.stock > 0,
    deliveryDays: 4,
    perks: ["Free returns"],
  };
}

export default function CartPage() {
  const i18n = useInterfaceTranslations("InterfaceCartPage");
  const { pricingReady: catalogPricingReady } = useCurrency();
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { data: session, status } = useSession();

  const items = useSelector((state: RootState) => state.cart.items);
  const summary = useSelector((state: RootState) => state.cart.summary);
  const mode = useSelector((state: RootState) => state.cart.mode);
  const isLoading = useSelector((state: RootState) => state.cart.isLoading);
  const isHydrated = useSelector((state: RootState) => state.cart.isHydrated);
  const error = useSelector((state: RootState) => state.cart.error);

  const [saved, setSaved] = useState<SavedItem[]>(() => readLocalSaved());
  const [promo, setPromo] = useState<AppliedPromo | null>(null);
  const [promoCandidate, setPromoCandidate] = useState<string | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [checkoutPreview, setCheckoutPreview] =
    useState<CheckoutPreview | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [previewToken, setPreviewToken] = useState(0);
  const [pendingQuantityUpdates, setPendingQuantityUpdates] = useState(0);
  const [deselectedItemIds, setDeselectedItemIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [isCheckoutPending, startCheckoutTransition] = useTransition();
  useLocaleSwitchGuard(pendingQuantityUpdates > 0 || isCheckoutPending);
  const cartSelectionDraft = { deselectedIds: [...deselectedItemIds], promoCode: promo?.code ?? promoCandidate ?? "" };
  useLocaleDraft("cart-selection", cartSelectionDraft, (update) => {
    const next = typeof update === "function" ? update(cartSelectionDraft) : update;
    if (Array.isArray(next.deselectedIds)) setDeselectedItemIds(new Set(next.deselectedIds.filter((id) => typeof id === "string")));
    setPromoCandidate(next.promoCode || null);
  }, ["deselectedIds", "promoCode"]);
  const itemsRef = useRef(items);
  const quantitySyncsRef = useRef(new Map<string, PendingQuantitySync>());
  const quantityVersionsRef = useRef(new Map<string, number>());
  const quantityRequestChainsRef = useRef(new Map<string, Promise<void>>());

  const canUseServer = canUseServerCart(session?.user?.role, status);

  const {
    visibleItems: visibleCartItems,
    queueRemoval: queueCartRemoval,
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

  useEffect(() => {
    const pendingSyncs = quantitySyncsRef.current;
    const quantityVersions = quantityVersionsRef.current;
    const quantityRequestChains = quantityRequestChainsRef.current;
    return () => {
      for (const pending of pendingSyncs.values()) {
        clearTimeout(pending.timeoutId);
      }
      pendingSyncs.clear();
      quantityVersions.clear();
      quantityRequestChains.clear();
    };
  }, []);

  const cartTotals = useMemo(() => {
    const localItemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const localSubtotal = items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );
    const itemCount = mode === "server" ? summary.totalItems : localItemCount;
    const subtotal = mode === "server" ? summary.subtotal : localSubtotal;

    return {
      itemCount,
      subtotal,
    };
  }, [items, mode, summary]);

  const selectableItems = useMemo(
    () => items.filter((item) => item.status === "ACTIVE" && item.stock > 0),
    [items],
  );
  const selectedItems = useMemo(
    () =>
      selectableItems.filter((item) => !deselectedItemIds.has(item.id)),
    [deselectedItemIds, selectableItems],
  );
  const selectedItemIds = useMemo(
    () => new Set(selectedItems.map((item) => item.id)),
    [selectedItems],
  );
  const selectedTotals = useMemo(
    () => ({
      itemCount: selectedItems.reduce(
        (total, item) => total + item.quantity,
        0,
      ),
      subtotal: selectedItems.reduce(
        (total, item) => total + item.unitPrice * item.quantity,
        0,
      ),
    }),
    [selectedItems],
  );
  const allItemsSelected =
    selectableItems.length > 0 && selectedItems.length === selectableItems.length;
  const someItemsSelected = selectedItems.length > 0 && !allItemsSelected;

  const promoCodeForPreview = promoCandidate ?? promo?.code ?? null;
  const pricingReady =
    isHydrated &&
    status !== "loading" &&
    selectedItems.length > 0 &&
    pendingQuantityUpdates === 0 &&
    (!canUseServer || (mode === "server" && !isLoading));

  useEffect(() => {
    if (!pricingReady) return;

    let ignore = false;

    void (async () => {
      setPricingLoading(true);
      setPricingError(null);

      try {
        const next = await fetchCheckoutPreview({
          items: selectedItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            ...(item.variantId ? { variantId: item.variantId } : {}),
          })),
          deliveryZone: "INSIDE_DHAKA",
          promoCode: promoCodeForPreview,
        });
        if (ignore) return;

        setCheckoutPreview(next);

        if (promoCodeForPreview) {
          if (next.promo?.ok) {
            setPromo({
              code: next.promo.code,
              discountUSD: next.promo.baseDiscount,
              description: next.promo.description,
            });
            setPromoCandidate(null);
            setPromoError(null);
          } else {
            const reason =
              next.promo && !next.promo.ok
                ? next.promo.reason
                : "Promo code could not be applied.";
            setPromo(null);
            setPromoCandidate(promoCodeForPreview);
            setPromoError(reason);
          }
        } else {
          setPromo(null);
        }
      } catch (requestError) {
        if (ignore) return;
        const message =
          requestError instanceof Error
            ? requestError.message
            : "Failed to verify cart totals.";
        setCheckoutPreview(null);
        setPricingError(message);
      } finally {
        if (!ignore) setPricingLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [
    canUseServer,
    pricingReady,
    previewToken,
    promoCodeForPreview,
    selectedItems,
  ]);

  const finishQuantitySync = (id: string, version: number) => {
    const current = quantitySyncsRef.current.get(id);
    if (!current || current.version !== version) return false;

    quantitySyncsRef.current.delete(id);
    setPendingQuantityUpdates((count) => Math.max(0, count - 1));
    return true;
  };

  const preservePendingQuantities = (serverItems: CartItem[]) => {
    const optimisticItems = new Map(
      itemsRef.current.map((item) => [item.id, item]),
    );

    return serverItems.map((item) => {
      if (!quantitySyncsRef.current.has(item.id)) return item;

      const optimisticItem = optimisticItems.get(item.id);
      if (!optimisticItem) return item;

      return {
        ...item,
        quantity: optimisticItem.quantity,
        lineTotal: item.unitPrice * optimisticItem.quantity,
      };
    });
  };

  const persistQuantityToServer = async (
    id: string,
    quantity: number,
    version: number,
  ) => {
    try {
      await updateCartItemOnServer(id, quantity);
      if (quantitySyncsRef.current.get(id)?.version !== version) return;

      const snapshot = await fetchServerCartSnapshot();
      if (!finishQuantitySync(id, version)) return;

      const nextItems = preservePendingQuantities(snapshot.items);
      itemsRef.current = nextItems;
      writeLocalCart(nextItems);
      dispatch(
        setCartData({
          items: nextItems,
          summary: computeCartSummary(nextItems),
        }),
      );
      setPreviewToken((token) => token + 1);
    } catch (requestError) {
      const current = quantitySyncsRef.current.get(id);
      if (!current || current.version !== version) return;

      let serverItems: CartItem[] | null = null;
      try {
        const snapshot = await fetchServerCartSnapshot();
        serverItems = snapshot.items;
      } catch {
        // Fall back to the last UI state from before this update sequence.
      }

      if (!finishQuantitySync(id, version)) return;

      const nextItems = serverItems
        ? preservePendingQuantities(serverItems)
        : itemsRef.current.map((item) =>
            item.id === id ? current.rollbackItem : item,
          );
      itemsRef.current = nextItems;
      writeLocalCart(nextItems);
      dispatch(
        setCartData({
          items: nextItems,
          summary: computeCartSummary(nextItems),
        }),
      );

      const message =
        requestError instanceof Error
          ? requestError.message
          : "Failed to update cart quantity.";
      dispatch(setCartError(message));
      toast.error(i18n(message));
      setPreviewToken((token) => token + 1);
    }
  };

  const scheduleQuantitySync = (
    id: string,
    quantity: number,
    rollbackItem: CartItem,
  ) => {
    const existing = quantitySyncsRef.current.get(id);
    if (existing) clearTimeout(existing.timeoutId);

    const version = (quantityVersionsRef.current.get(id) ?? 0) + 1;
    quantityVersionsRef.current.set(id, version);
    const timeoutId = setTimeout(() => {
      const previousRequest =
        quantityRequestChainsRef.current.get(id) ?? Promise.resolve();
      const queuedRequest = previousRequest
        .catch(() => undefined)
        .then(() => persistQuantityToServer(id, quantity, version));

      quantityRequestChainsRef.current.set(id, queuedRequest);
      void queuedRequest.then(
        () => {
          if (quantityRequestChainsRef.current.get(id) === queuedRequest) {
            quantityRequestChainsRef.current.delete(id);
          }
        },
        () => {
          if (quantityRequestChainsRef.current.get(id) === queuedRequest) {
            quantityRequestChainsRef.current.delete(id);
          }
        },
      );
    }, QUANTITY_SYNC_DEBOUNCE_MS);

    quantitySyncsRef.current.set(id, {
      timeoutId,
      version,
      rollbackItem: existing?.rollbackItem ?? rollbackItem,
    });
    if (!existing) setPendingQuantityUpdates((count) => count + 1);
  };

  const cancelQuantitySync = (id: string) => {
    const pending = quantitySyncsRef.current.get(id);
    if (!pending) return;

    clearTimeout(pending.timeoutId);
    quantitySyncsRef.current.delete(id);
    quantityVersionsRef.current.set(id, pending.version + 1);
    setPendingQuantityUpdates((count) => Math.max(0, count - 1));
  };

  const handleQuantityChange = (id: string, quantity: number) => {
    const currentItems = itemsRef.current;
    const target = currentItems.find((item) => item.id === id);
    if (!target) return;

    const verifiedTarget = mergeCartItemWithCheckoutPreview(
      target,
      pricingReady && !pricingLoading ? checkoutPreview : null,
    );
    const requestedQuantity = Number.isFinite(quantity)
      ? Math.trunc(quantity)
      : target.quantity;
    const safeQuantity = Math.max(
      1,
      Math.min(verifiedTarget.stock || 1, requestedQuantity),
    );
    if (safeQuantity === target.quantity) return;

    dispatch(setCartError(null));

    // Update Redux and local storage before any network request so the
    // quantity, totals, and navbar badge respond immediately.
    const updatedItems = currentItems.map((item) =>
      item.id === id
        ? {
            ...item,
            quantity: safeQuantity,
            lineTotal: item.unitPrice * safeQuantity,
          }
        : item,
    );
    itemsRef.current = updatedItems;
    writeLocalCart(updatedItems);
    dispatch(
      setCartData({
        items: updatedItems,
        summary: computeCartSummary(updatedItems),
      }),
    );

    if (canUseServer) {
      setCheckoutPreview(null);
      scheduleQuantitySync(id, safeQuantity, target);
    }
  };

  const removeSavedFromLocal = (id: string) => {
    setSaved((prev) => {
      const next = prev.filter((item) => item.id !== id);
      writeLocalSaved(next);
      return next;
    });
  };

  const commitRemoveFromCart = async (id: string) => {
    cancelQuantitySync(id);
    dispatch(setCartError(null));

    if (canUseServer) {
      try {
        await removeCartItemOnServer(id);
        const snapshot = await fetchServerCartSnapshot();
        dispatch(setCartData(snapshot));
        writeLocalCart(snapshot.items);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to remove item from cart.";
        dispatch(setCartError(message));
        throw new Error(message);
      }
      return;
    }

    const next = itemsRef.current.filter((item) => item.id !== id);
    writeLocalCart(next);
    dispatch(setCartData({ items: next, summary: computeCartSummary(next) }));
  };

  const handleRemove = async (id: string) => {
    const target = items.find((item) => item.id === id);
    if (!target) return;

    const ok = await confirm({
      title: i18n("Remove item?"),
      description: `"${target.name}" will be removed from your cart.`,
      confirmLabel: "Remove",
      variant: "danger",
    });
    if (!ok) return;

    queueCartRemoval(
      id,
      async () => {
        await commitRemoveFromCart(id);
        toast.success(i18n("Item removed from cart"));
      },
      (error) => {
        const message =
          error instanceof Error ? error.message : "Failed to remove item from cart.";
        toast.error(i18n(message));
      },
    );
  };

  const handleSaveForLater = (id: string) => {
    const target = items.find((item) => item.id === id);
    if (!target) return;

    const savedItem = toSavedItem(
      mergeCartItemWithCheckoutPreview(
        target,
        pricingReady && !pricingLoading ? checkoutPreview : null,
      ),
    );

    queueCartRemoval(
      id,
      async () => {
        await commitRemoveFromCart(id);
        setSaved((prev) => {
          const next = [savedItem, ...prev.filter((item) => item.id !== savedItem.id)];
          writeLocalSaved(next);
          return next;
        });
        toast.info(i18n("Saved for later"));
      },
      (error) => {
        const message =
          error instanceof Error ? error.message : "Failed to save item for later.";
        toast.error(i18n(message));
      },
    );
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

    queueSavedRemoval(
      id,
      async () => {
        if (canUseServer) {
          dispatch(setCartError(null));

          try {
            await addToCartOnServer(target.productId, 1, target.variantId, cartEventId);
            const snapshot = await fetchServerCartSnapshot();
            dispatch(setCartData(snapshot));
            writeLocalCart(snapshot.items);
          } catch (err) {
            const message =
              err instanceof Error ? err.message : "Failed to move saved item to cart.";
            dispatch(setCartError(message));
            throw new Error(message);
          }
        } else {
          const localCartBefore = readLocalCart();
          const savedKey = cartItemKey(target);
          const existing = localCartBefore.find(
            (item) => cartItemKey(item) === savedKey,
          );
          const nextItem: CartItem = existing
            ? {
                ...existing,
                quantity: existing.quantity + 1,
                lineTotal: existing.unitPrice * (existing.quantity + 1),
              }
            : {
                id: `local:${target.variantId ?? target.productId}`,
                productId: target.productId,
                productCode: target.productCode,
                variantId: target.variantId ?? null,
                sku: target.sku ?? null,
                variantName: target.variantName ?? null,
                color: target.color ?? null,
                size: target.size ?? null,
                attributes: target.attributes ?? null,
                attributeSummary: target.attributeSummary ?? null,
                name: target.name,
                image: target.image,
                quantity: 1,
                unitPrice: target.price,
                originalPrice: target.originalPrice ?? target.price,
                lineTotal: target.price,
                stock: 10,
                status: "ACTIVE",
              };

          const localCartAfter = existing
            ? localCartBefore.map((item) =>
                cartItemKey(item) === savedKey ? nextItem : item,
              )
            : [nextItem, ...localCartBefore];

          writeLocalCart(localCartAfter);
          dispatch(
            setCartData({
              items: localCartAfter,
              summary: computeCartSummary(localCartAfter),
            }),
          );
          if (catalogPricingReady !== false) trackLocalCartAddition(localCartBefore, localCartAfter, cartEventId);
        }

        removeSavedFromLocal(id);
        toast.success(i18n(`${target.name} moved to cart`));
      },
      (error) => {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to move saved item to cart.";
        toast.error(i18n(message));
      },
    );
  };

  const handleApplyPromo = (code: string) => {
    if (selectedItems.length === 0) {
      setPromoError("Select at least one product before applying a promo code.");
      return;
    }

    const normalized = normalizeCheckoutPromoCode(code);
    if (!normalized) {
      setPromoError("Enter a promo code between 2 and 40 characters.");
      return;
    }

    setPromoError(null);
    setPromoCandidate(normalized);
    setPreviewToken((token) => token + 1);
  };

  const handleRemovePromo = () => {
    setPromo(null);
    setPromoCandidate(null);
    setPromoError(null);
    toast.info(i18n("Promo code removed"));
  };

  const handleToggleItemSelection = (id: string) => {
    setDeselectedItemIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setCheckoutPreview(null);
    setPricingLoading(false);
    setPricingError(null);
  };

  const handleToggleSelectAll = () => {
    setDeselectedItemIds((current) => {
      const next = new Set(current);
      for (const item of selectableItems) {
        if (allItemsSelected) {
          next.add(item.id);
        } else {
          next.delete(item.id);
        }
      }
      return next;
    });
    setCheckoutPreview(null);
    setPricingLoading(false);
    setPricingError(null);
  };

  const handleCheckout = () => {
    if (selectedItems.length === 0) {
      toast.info(i18n("Select at least one product to checkout."));
      return;
    }

    if (pendingQuantityUpdates > 0) {
      toast.info(i18n("Updating your cart quantity. Please wait a moment."));
      return;
    }

    const target = buildCartSelectionCheckoutHref(selectedItems, promo?.code);
    startCheckoutTransition(() => {
      router.push(target);
    });
  };

  const isEmpty = items.length === 0;
  const verifiedPreview =
    pricingReady && !pricingLoading && selectedItems.length > 0
      ? checkoutPreview
      : null;
  const verifiedSummary = verifiedPreview
    ? toCanonicalCartSummary(verifiedPreview.summary)
    : null;
  const itemCards = visibleCartItems.map((item) =>
    toCartViewModel(mergeCartItemWithCheckoutPreview(item, verifiedPreview)),
  );
  const mobileAmountUSD =
    verifiedSummary?.totalUSD ?? selectedTotals.subtotal;
  const isQuantitySyncing = pendingQuantityUpdates > 0;
  const isCartBootstrapping = shouldShowCartBootstrap({
    isHydrated,
    isLoading,
    sessionStatus: status,
  });

  if (catalogPricingReady === false) return <PricingUnavailable />;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <CartHeader itemCount={cartTotals.itemCount} />

        <div className="mt-2 flex items-center justify-between px-1 text-xs text-muted-foreground">
          <span>{i18n("Storage mode: {mode}", { mode: mode === "server" ? i18n("Server + Local") : i18n("Local only") })}</span>
          {isLoading && (
            <span className="inline-flex items-center gap-1.5">
              <LoadingSpinner decorative size="xs" />
              {i18n("Syncing cart...")}</span>
          )}
        </div>

        {error && (
          <div className="mt-3 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">
            {i18n(error)}
          </div>
        )}

        {pricingError && !error && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {pricingError} {i18n("Shipping, tax, and promotions will be checked again at checkout.")}</div>
        )}

        {isCartBootstrapping || (isLoading && isEmpty) ? (
          <SectionLoader title={i18n("Loading cart")} rows={6} className="mt-6" />
        ) : isEmpty ? (
          <>
            <EmptyCart />
            {visibleSavedItems.length > 0 && (
              <div className="mt-6">
                <SavedForLater
                  items={visibleSavedItems}
                  onMoveToCart={handleSavedMoveToCart}
                  onRemove={handleSavedRemove}
                />
              </div>
            )}
          </>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8">
            <div className="flex min-w-0 flex-col gap-4">
              {verifiedSummary &&
                verifiedSummary.freeShippingThresholdUSD > 0 && (
                <FreeShippingBar
                  subtotalUSD={
                    verifiedSummary.subtotalUSD - verifiedSummary.discountUSD
                  }
                  thresholdUSD={verifiedSummary.freeShippingThresholdUSD}
                />
              )}

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-3 py-2.5 shadow-sm sm:px-4">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={someItemsSelected ? "mixed" : allItemsSelected}
                    onClick={handleToggleSelectAll}
                    disabled={selectableItems.length === 0}
                    className="inline-flex min-w-0 items-center gap-2.5 rounded-xl px-1 py-1 text-sm font-semibold text-foreground transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-colors ${
                        allItemsSelected || someItemsSelected
                          ? "border-primary bg-primary text-white"
                          : "border-border bg-card text-transparent"
                      }`}
                    >
                      {someItemsSelected ? (
                        <Minus className="h-3.5 w-3.5" strokeWidth={3} />
                      ) : (
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      )}
                    </span>
                    <span>{allItemsSelected ? i18n("Deselect all") : i18n("Select all")}</span>
                  </button>
                  <span className="shrink-0 text-xs font-medium text-muted-foreground">
                    {i18n("{selected, number} of {total, number} selected", { selected: selectedItems.length, total: selectableItems.length })}</span>
                </div>

                <AnimatePresence initial={false} mode="popLayout">
                  {itemCards.map((item) => (
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
                      <CartItemCard
                        item={item}
                        onQuantityChange={handleQuantityChange}
                        onRemove={handleRemove}
                        onSaveForLater={handleSaveForLater}
                        selected={selectedItemIds.has(item.id)}
                        selectionDisabled={!item.inStock}
                        onSelectionChange={handleToggleItemSelection}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-dashed border-border bg-brand-white/60 px-4 py-3 text-sm">
                <p className="text-body">{i18n("Looking for something else?")}</p>
                <Link
                  href="/products"
                  className="font-semibold text-primary hover:underline"
                >
                  {i18n("Continue shopping")}{"->"}
                </Link>
              </div>

              <SavedForLater
                items={visibleSavedItems}
                onMoveToCart={handleSavedMoveToCart}
                onRemove={handleSavedRemove}
              />
            </div>

            <div className="hidden lg:block">
              <OrderSummary
                summary={verifiedSummary}
                fallbackSubtotalUSD={selectedTotals.subtotal}
                itemCount={selectedTotals.itemCount}
                promo={promo}
                promoError={promoError}
                onApplyPromo={handleApplyPromo}
                onRemovePromo={handleRemovePromo}
                onPromoErrorClear={() => setPromoError(null)}
                onCheckout={handleCheckout}
                isApplyingPromo={pricingLoading && promoCodeForPreview !== null}
                isCheckingOut={isCheckoutPending}
                isPricingLoading={pricingReady && pricingLoading}
                isCartSyncing={isQuantitySyncing}
                isCheckoutDisabled={selectedItems.length === 0}
              />
            </div>

            <div className="min-w-0 lg:hidden">
              <OrderSummary
                summary={verifiedSummary}
                fallbackSubtotalUSD={selectedTotals.subtotal}
                itemCount={selectedTotals.itemCount}
                promo={promo}
                promoError={promoError}
                onApplyPromo={handleApplyPromo}
                onRemovePromo={handleRemovePromo}
                onPromoErrorClear={() => setPromoError(null)}
                onCheckout={handleCheckout}
                isApplyingPromo={pricingLoading && promoCodeForPreview !== null}
                isCheckingOut={isCheckoutPending}
                isPricingLoading={pricingReady && pricingLoading}
                isCartSyncing={isQuantitySyncing}
                isCheckoutDisabled={selectedItems.length === 0}
              />
            </div>
          </div>
        )}

        {!isEmpty && (
          <div className="h-[calc(6rem+env(safe-area-inset-bottom))] lg:hidden" />
        )}
      </div>

      {!isEmpty && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-brand-white/95 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-lg shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.15)] min-[360px]:px-4 lg:hidden">
          <div className="mx-auto flex max-w-2xl items-center gap-2 min-[360px]:gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-muted-foreground">
                {verifiedSummary ? i18n("Total") : i18n("Subtotal")} ({selectedTotals.itemCount}{" "}
                {selectedTotals.itemCount === 1 ? i18n("item") : i18n("items")})
              </p>
              <p className="text-base font-bold text-primary min-[360px]:text-lg">
                <CurrencyAmount amountUSD={mobileAmountUSD} />
              </p>
            </div>
            <button
              type="button"
              onClick={handleCheckout}
              disabled={
                isCheckoutPending ||
                isQuantitySyncing ||
                selectedItems.length === 0
              }
              aria-busy={isCheckoutPending || isQuantitySyncing}
              className="inline-flex h-12 shrink-0 items-center gap-2 rounded-2xl bg-primary px-3 text-sm font-bold text-primary-foreground shadow-md transition-colors duration-200 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 min-[360px]:px-5"
            >
              {isQuantitySyncing ? (
                <ButtonLoader
                  label={
                    <>
                      <span className="min-[360px]:hidden">{i18n("Updating...")}</span>
                      <span className="hidden min-[360px]:inline">
                        {i18n("Updating cart...")}</span>
                    </>
                  }
                />
              ) : isCheckoutPending ? (
                <ButtonLoader
                  label={
                    <>
                      <span className="min-[360px]:hidden">{i18n("Opening...")}</span>
                      <span className="hidden min-[360px]:inline">
                        {i18n("Opening checkout...")}</span>
                    </>
                  }
                />
              ) : selectedItems.length === 0 ? (
                i18n("Select items")
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  {i18n("Checkout")}</>
              )}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
