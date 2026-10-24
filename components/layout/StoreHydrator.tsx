"use client";

import { useEffect, useRef } from "react";
import { useCurrency } from "@/components/currency/CurrencyProvider";
import { useDispatch, useSelector } from "react-redux";
import { useSession } from "@/lib/auth/use-app-session";

import type { AppDispatch, RootState } from "@/store";
import {
  resetCartState,
  setCartData,
  setCartError,
  setCartLoading,
  setCartMode,
} from "@/store/slices/cart.slice";
import {
  resetWishlistState,
  setWishlistError,
  setWishlistItems,
  setWishlistLoading,
  setWishlistMode,
} from "@/store/slices/wishlist.slice";
import { readLocalCart, writeLocalCart } from "@/features/cart/storage";
import { CART_LOCAL_STORAGE_KEY } from "@/features/cart/storage";
import { computeCartSummary } from "@/features/cart/summary";
import {
  canUseServerCart,
  fetchServerCartSnapshot,
  mergeGuestCartToServer,
} from "@/features/cart/api";
import {
  readLocalWishlist,
  writeLocalWishlist,
  WISHLIST_LOCAL_STORAGE_KEY,
} from "@/features/wishlist/storage";
import {
  canUseServerWishlist,
  fetchServerWishlist,
  mergeGuestWishlistToServer,
} from "@/features/wishlist/api";

/**
 * Invisible component that manages the lifecycle of cart & wishlist
 * Redux state across guest / authenticated sessions.
 *
 * Responsibilities:
 *   1. Hydrate Redux from localStorage on first mount so navbar badges
 *      render correct counts immediately (before any server call).
 *   2. When the session resolves to "authenticated", merge any guest
 *      localStorage data into the server via dedicated merge APIs,
 *      then replace Redux + localStorage with the server response.
 *   3. Detect session transitions:
 *      - login  (unauthenticated → authenticated): run merge flow
 *      - logout (authenticated → unauthenticated): reset Redux + clear localStorage
 *
 * Must sit inside both `<ReduxProvider>` and `<SessionProvider>`.
 * Renders nothing — pure side-effect.
 */
export default function StoreHydrator() {
  const { pricingReady } = useCurrency();
  const dispatch = useDispatch<AppDispatch>();
  const { data: session, status } = useSession();
  const cartHydrated = useSelector((s: RootState) => s.cart.isHydrated);
  const wishlistHydrated = useSelector((s: RootState) => s.wishlist.isHydrated);

  // Guards against React Strict Mode double-mount
  const didLocalHydrateRef = useRef(false);
  // Prevent concurrent server-sync operations
  const serverSyncInProgressRef = useRef(false);
  // Invalidate stale responses when the authenticated user changes or logs out.
  const serverSyncGenerationRef = useRef(0);
  const authenticatedUserKeyRef = useRef<string | null>(null);

  /* ═══════════════════════════════════════════════════════════════════
   * Phase 1: Immediate localStorage hydration
   *
   * Runs once on mount. Populates Redux with whatever is in
   * localStorage so the navbar badges are visible instantly.
   * ═══════════════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (pricingReady !== true) return;
    if (didLocalHydrateRef.current) return;
    didLocalHydrateRef.current = true;

    if (!cartHydrated) {
      const localCart = readLocalCart();
      dispatch(
        setCartData({
          items: localCart,
          summary: computeCartSummary(localCart),
        }),
      );
    }

    if (!wishlistHydrated) {
      const localWishlist = readLocalWishlist();
      dispatch(setWishlistItems(localWishlist));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricingReady]);

  /* ═══════════════════════════════════════════════════════════════════
   * Phase 2 & 3: Session-aware sync + transition detection
   *
   * Runs whenever the NextAuth session status changes. Handles:
   *   • First "authenticated" resolution → merge guest data & fetch
   *   • unauthenticated → authenticated (login)  → merge
   *   • authenticated → unauthenticated (logout)  → reset
   * ═══════════════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (pricingReady !== true) {
      serverSyncGenerationRef.current += 1;
      serverSyncInProgressRef.current = false;
      return;
    }
    // Still loading — nothing to do yet.
    if (status === "loading") return;

    /* ── Logout: authenticated → unauthenticated ──────────────────── */
    if (status === "unauthenticated") {
      const wasAuthenticated = authenticatedUserKeyRef.current !== null;
      authenticatedUserKeyRef.current = null;
      serverSyncGenerationRef.current += 1;
      serverSyncInProgressRef.current = false;

      if (wasAuthenticated) {
        dispatch(resetCartState());
        dispatch(resetWishlistState());
        window.localStorage.removeItem(CART_LOCAL_STORAGE_KEY);
        window.localStorage.removeItem(WISHLIST_LOCAL_STORAGE_KEY);
      }
      return;
    }

    /* ── Authenticated: fetch/merge from server ───────────────────── */
    const role = session?.user?.role;
    const currentUserKey =
      session?.user?.id ?? session?.user?.email ?? "authenticated";
    const previousUserKey = authenticatedUserKeyRef.current;
    const userChanged =
      previousUserKey !== null && previousUserKey !== currentUserKey;

    if (userChanged) {
      serverSyncGenerationRef.current += 1;
      serverSyncInProgressRef.current = false;
      dispatch(resetCartState());
      dispatch(resetWishlistState());
      window.localStorage.removeItem(CART_LOCAL_STORAGE_KEY);
      window.localStorage.removeItem(WISHLIST_LOCAL_STORAGE_KEY);
    }
    authenticatedUserKeyRef.current = currentUserKey;

    if (serverSyncInProgressRef.current) return;

    const canSyncCart = canUseServerCart(role, status);
    const canSyncWishlist = canUseServerWishlist(role, status);
    if (!canSyncCart && !canSyncWishlist) return;

    const localCartItems = readLocalCart();
    const localWishlistItems = readLocalWishlist();
    const shouldMergeCart = localCartItems.some((item) =>
      item.id.startsWith("local:"),
    );
    const shouldMergeWishlist =
      previousUserKey === null && localWishlistItems.length > 0;
    const syncGeneration = ++serverSyncGenerationRef.current;
    const isCurrentSync = () =>
      serverSyncGenerationRef.current === syncGeneration;
    const operations: Promise<void>[] = [];

    serverSyncInProgressRef.current = true;

    // Cart: merge or fetch
    if (canSyncCart) {
      dispatch(setCartError(null));
      dispatch(setCartLoading(true));
      dispatch(setCartMode("server"));

      const cartPromise = shouldMergeCart
        ? mergeGuestCartToServer(localCartItems)
        : fetchServerCartSnapshot();

      operations.push(
        cartPromise
          .then((snapshot) => {
            if (!isCurrentSync()) return;
            writeLocalCart(snapshot.items);
            dispatch(setCartData(snapshot));
          })
          .catch((error: unknown) => {
            if (!isCurrentSync()) return;
            dispatch(setCartMode("local"));
            dispatch(
              setCartError(
                error instanceof Error
                  ? error.message
                  : "Failed to load cart from server.",
              ),
            );
            // Keep the already-hydrated local snapshot as the fallback.
          })
          .finally(() => {
            if (isCurrentSync()) dispatch(setCartLoading(false));
          }),
      );
    }

    // Wishlist: merge or fetch
    if (canSyncWishlist) {
      dispatch(setWishlistError(null));
      dispatch(setWishlistLoading(true));
      dispatch(setWishlistMode("server"));

      const wishlistPromise = shouldMergeWishlist
        ? mergeGuestWishlistToServer(localWishlistItems.map((item) => item.id))
        : fetchServerWishlist();

      operations.push(
        wishlistPromise
          .then((items) => {
            if (!isCurrentSync()) return;
            writeLocalWishlist(items);
            dispatch(setWishlistItems(items));
          })
          .catch((error: unknown) => {
            if (!isCurrentSync()) return;
            dispatch(setWishlistMode("local"));
            dispatch(
              setWishlistError(
                error instanceof Error
                  ? error.message
                  : "Failed to load wishlist from server.",
              ),
            );
            // Keep the already-hydrated local snapshot as the fallback.
          })
          .finally(() => {
            if (isCurrentSync()) dispatch(setWishlistLoading(false));
          }),
      );
    }

    void Promise.allSettled(operations).finally(() => {
      if (isCurrentSync()) serverSyncInProgressRef.current = false;
    });

    /* ── Unauthenticated (guest): localStorage is already loaded ── */
    // Phase 1 already populated Redux from localStorage.
    // Nothing more to do for guests.
  }, [
    pricingReady,
    status,
    session?.user?.email,
    session?.user?.id,
    session?.user?.role,
    dispatch,
  ]);

  useEffect(
    () => () => {
      serverSyncGenerationRef.current += 1;
      serverSyncInProgressRef.current = false;
    },
    [],
  );

  return null;
}
