"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { useEffect, useRef } from "react";
import Link from "@/lib/i18n/navigation";
import {
  ArrowRight,
  Lock,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useSession } from "@/lib/auth/use-app-session";
import { useDispatch, useSelector } from "react-redux";

import {
  canUseServerCart,
  fetchServerCartSnapshot,
  removeCartItemOnServer,
  updateCartItemOnServer,
} from "@/features/cart/api";
import type { CartItem } from "@/features/cart/api";
import { computeCartSummary } from "@/features/cart/summary";
import { writeLocalCart } from "@/features/cart/storage";
import {
  setCartData,
  setCartError,
} from "@/store/slices/cart.slice";
import type { AppDispatch, RootState } from "@/store";
import { CurrencyAmount } from "@/components/currency/CurrencyAmount";
import ColorBadge from "@/components/ui/ColorBadge";
import { toast } from "@/lib/feedback";
import { useAnimatedRemoval } from "@/hooks/useAnimatedRemoval";
import { SectionLoader } from "@/components/ui/loading";
import {
  LIST_ITEM_TRANSITION,
  LIST_ITEM_VARIANTS,
} from "@/lib/motion/list-removal";

import { FALLBACK_PRODUCT_IMAGE } from "./constants";

const PROFILE_PREVIEW_LIMIT = 6;

/**
 * Cart preview tab on the profile page.
 *
 * Consumes the cart hydrated by the root StoreHydrator and presents a
 * compact list with quantity steppers and a deep link to the full cart.
 */
export default function CartTab() {
  const i18n = useInterfaceTranslations("InterfaceProfileComponentsCartTab");
  const dispatch = useDispatch<AppDispatch>();
  const { data: session, status } = useSession();

  const items = useSelector((state: RootState) => state.cart.items);
  const summary = useSelector((state: RootState) => state.cart.summary);
  const isLoading = useSelector((state: RootState) => state.cart.isLoading);
  const error = useSelector((state: RootState) => state.cart.error);
  const itemsRef = useRef(items);

  const canUseServer = canUseServerCart(session?.user?.role, status);
  const { visibleItems, queueRemoval } = useAnimatedRemoval({
    items,
    getId: (item) => item.id,
  });

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const handleQuantityChange = async (item: CartItem, nextQty: number) => {
    const safeQty = Math.max(1, Math.min(item.stock || 1, nextQty));
    if (safeQty === item.quantity) return;

    dispatch(setCartError(null));

    if (canUseServer) {
      try {
        await updateCartItemOnServer(item.id, safeQty);
        const snapshot = await fetchServerCartSnapshot();
        dispatch(setCartData(snapshot));
        writeLocalCart(snapshot.items);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to update cart.";
        dispatch(setCartError(message));
      }
      return;
    }

    const next = items.map((entry) =>
      entry.id === item.id
        ? {
            ...entry,
            quantity: safeQty,
            lineTotal: entry.unitPrice * safeQty,
          }
        : entry,
    );
    writeLocalCart(next);
    dispatch(
      setCartData({ items: next, summary: computeCartSummary(next) }),
    );
  };

  const handleRemove = (item: CartItem) => {
    queueRemoval(
      item.id,
      async () => {
        dispatch(setCartError(null));

        if (canUseServer) {
          try {
            await removeCartItemOnServer(item.id);
            const snapshot = await fetchServerCartSnapshot();
            dispatch(setCartData(snapshot));
            writeLocalCart(snapshot.items);
          } catch (err) {
            const message =
              err instanceof Error ? err.message : "Failed to remove cart item.";
            dispatch(setCartError(message));
            throw new Error(message);
          }
        } else {
          const next = itemsRef.current.filter((entry) => entry.id !== item.id);
          writeLocalCart(next);
          dispatch(setCartData({ items: next, summary: computeCartSummary(next) }));
        }

        toast.success(i18n("Item removed from cart"));
      },
      (error) => {
        const message =
          error instanceof Error ? error.message : "Failed to remove cart item.";
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
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-background text-foreground">
              <ShoppingBag className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-foreground sm:text-lg">
                {i18n("Cart")}</h2>
              <p className="text-xs text-muted-foreground">
                {summary.totalItems}{" "}
                {summary.totalItems === 1 ? i18n("item") : i18n("items")} {i18n("ready to check out · subtotal")}<CurrencyAmount amountUSD={summary.subtotal} />
              </p>
            </div>
          </div>
          <Link
            href="/cart"
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-primary transition-all duration-200 hover:-translate-y-0.5 hover:border-primary hover:bg-background sm:w-auto"
          >
            {i18n("Open cart")}<ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
          </Link>
        </div>
      </header>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {i18n(error)}
        </div>
      )}

      {isLoading && items.length === 0 ? (
        <SectionLoader title={i18n("Loading cart")} rows={4} />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm sm:rounded-3xl sm:p-10">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-background text-foreground">
            <ShoppingBag className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-lg font-bold text-foreground">
            {i18n("Your cart is empty")}</h3>
          <p className="mt-1 text-sm text-body">
            {i18n("Add products to your cart to see them here.")}</p>
          <Link
            href="/products"
            className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-xl"
          >
            <ShoppingBag className="h-4 w-4" />
            {i18n("Browse products")}</Link>
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-3">
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
                  className="grid grid-cols-[56px_minmax(0,1fr)] items-start gap-3 overflow-hidden rounded-2xl border border-border bg-card p-3 shadow-sm sm:grid-cols-[64px_minmax(0,1fr)_auto] sm:items-center sm:p-4"
                >
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-border bg-background sm:h-16 sm:w-16">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.image || FALLBACK_PRODUCT_IMAGE}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/products/${item.productId}`}
                    className="line-clamp-2 text-sm font-bold text-foreground hover:text-primary"
                  >
                    {item.name}
                  </Link>
                  {[item.color, item.size].filter(Boolean).length > 0 && (
                    <ColorBadge
                      color={item.color}
                      size={item.size}
                      className="mt-0.5"
                    />
                  )}
                  {(item.variantName || item.attributeSummary) && (
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                      {[item.variantName, item.attributeSummary]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    <CurrencyAmount amountUSD={item.unitPrice} />
                    {item.originalPrice > item.unitPrice && (
                      <span className="ms-1.5 text-muted-foreground line-through">
                        <CurrencyAmount amountUSD={item.originalPrice} />
                      </span>
                    )}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center rounded-xl border border-border bg-card">
                      <button
                        type="button"
                        onClick={() =>
                          handleQuantityChange(item, item.quantity - 1)
                        }
                        disabled={item.quantity <= 1}
                        aria-label={i18n("Decrease quantity")}
                        className="grid h-8 w-8 place-items-center rounded-s-xl text-body transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="min-w-8 px-2 text-center text-sm font-bold text-foreground">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleQuantityChange(item, item.quantity + 1)
                        }
                        disabled={item.quantity >= item.stock}
                        aria-label={i18n("Increase quantity")}
                        className="grid h-8 w-8 place-items-center rounded-e-xl text-body transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemove(item)}
                      aria-label={i18n("Remove from cart")}
                      className="grid h-8 w-8 place-items-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600 transition-colors hover:bg-rose-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <p className="col-start-2 shrink-0 text-start text-sm font-bold text-foreground sm:col-start-3 sm:row-start-1 sm:text-end">
                  <CurrencyAmount amountUSD={item.lineTotal} />
                </p>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>

          {hiddenCount > 0 && (
            <Link
              href="/cart"
              className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border bg-card px-4 py-3 text-sm font-bold text-primary transition-colors hover:bg-background"
            >
              {i18n("View {count, plural, one {# more item} other {# more items}} in cart", { count: hiddenCount })}<ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Link>
          )}

          <section className="rounded-2xl border border-border bg-background p-4 shadow-sm sm:rounded-3xl sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {i18n("Subtotal")}</p>
                <p className="text-xl font-bold text-primary sm:text-2xl">
                  <CurrencyAmount amountUSD={summary.subtotal} />
                </p>
              </div>
              <Link
                href="/checkout"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-xl sm:w-auto"
              >
                <Lock className="h-4 w-4" />
                {i18n("Checkout")}</Link>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
