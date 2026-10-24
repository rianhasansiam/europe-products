"use client";
import { useLocaleDraft, useLocaleSwitchGuard } from "@/components/i18n/useLocaleDraft";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "@/lib/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/lib/i18n/navigation";
import { useSession } from "@/lib/auth/use-app-session";
import { useDispatch, useSelector } from "react-redux";

import {
  fetchCheckoutPreview,
  fetchCheckoutProfile,
  placeCheckoutOrder,
  CheckoutSubmissionError,
  type CheckoutItemInput,
  type CheckoutPaymentMethod,
  type CheckoutPreview,
  type PlaceOrderRequest,
} from "@/features/checkout/api";
import {
  resolveCheckoutIdempotencyAttempt,
  type CheckoutIdempotencyAttempt,
} from "@/features/checkout/idempotency";
import { normalizeCheckoutPromoCode } from "@/features/checkout/promo";
import {
  setCartData,
  setCartError,
} from "@/store/slices/cart.slice";
import { computeCartSummary } from "@/features/cart/summary";
import { fetchServerCartSnapshot } from "@/features/cart/api";
import { writeLocalCart } from "@/features/cart/storage";
import type { AppDispatch, RootState } from "@/store";
import { toast } from "@/lib/feedback";
import { BASE_CURRENCY } from "@/lib/currency/config";
import {
  getNavigationEventId,
  trackInitiateCheckout,
} from "@/lib/analytics/meta-pixel";
import { startAirwallexHostedCheckout } from "@/lib/airwallex/components/AirwallexPayButton";
import {
  CheckoutPageSkeleton,
  FullPageLoader,
} from "@/components/ui/loading";

import CheckoutHeader from "./components/CheckoutHeader";
import CheckoutItemsCard from "./components/CheckoutItemsCard";
import CustomerForm, {
  type CustomerFormState,
} from "./components/CustomerForm";
import PaymentMethodPicker from "./components/PaymentMethodPicker";
import OrderSummaryCard from "./components/OrderSummaryCard";

const EMPTY_FORM: CustomerFormState = {
  customerName: "",
  customerPhone: "",
  customerEmail: "",
  customerAddress: "",
  customerCity: "",
  deliveryZone: "",
  customerPostalCode: "",
  customerNote: "",
};

type CheckoutSource =
  | { kind: "cart" }
  | { kind: "cart-selection"; items: CheckoutItemInput[] }
  | { kind: "buy-now"; items: CheckoutItemInput[] };

function parseBuyNowParam(raw: string | null): CheckoutItemInput[] | null {
  if (!raw) return null;
  // Format: "<productId>:<quantity>[:<variantId>]" or a comma-separated
  // list of those.
  const parts = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const items: CheckoutItemInput[] = [];
  for (const part of parts) {
    const [productId, qtyRaw, variantId] = part.split(":");
    if (!productId) continue;
    const quantity = Math.max(1, Math.round(Number(qtyRaw ?? 1) || 1));
    items.push({
      productId: productId.trim(),
      quantity,
      ...(variantId ? { variantId: variantId.trim() } : {}),
    });
  }
  return items.length > 0 ? items : null;
}

function CheckoutPageInner() {
  const i18n = useInterfaceTranslations("InterfaceCheckoutPage");
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useDispatch<AppDispatch>();
  const { data: session, status: authStatus } = useSession();

  const items = useSelector((state: RootState) => state.cart.items);
  const cartMode = useSelector((state: RootState) => state.cart.mode);
  const cartIsHydrated = useSelector(
    (state: RootState) => state.cart.isHydrated,
  );
  const cartIsLoading = useSelector((state: RootState) => state.cart.isLoading);
  const cartError = useSelector((state: RootState) => state.cart.error);

  // Source: explicit Buy Now items, an explicit cart selection, or the full
  // saved cart when no item payload is present.
  const buyNowItems = useMemo(
    () => parseBuyNowParam(searchParams.get("buy")),
    [searchParams],
  );
  const isCartSelection = searchParams.get("source") === "cart";
  const source = useMemo<CheckoutSource>(
    () =>
      buyNowItems
        ? {
            kind: isCartSelection ? "cart-selection" : "buy-now",
            items: buyNowItems,
          }
        : { kind: "cart" },
    [buyNowItems, isCartSelection],
  );
  const carriedPromo = useMemo(
    () => normalizeCheckoutPromoCode(searchParams.get("promo")),
    [searchParams],
  );

  const [form, setForm] = useState<CustomerFormState>(EMPTY_FORM);
  useLocaleDraft("checkout-delivery", form, setForm, [
    "customerName", "customerPhone", "customerEmail", "customerAddress",
    "customerCity", "deliveryZone", "customerPostalCode", "customerNote",
  ]);
  const [paymentMethod, setPaymentMethod] =
    useState<CheckoutPaymentMethod>("AIRWALLEX");
  const [promoCode, setPromoCode] = useState<string>(carriedPromo ?? "");
  const [appliedPromo, setAppliedPromo] = useState<string | null>(carriedPromo);
  const checkoutChoices = { paymentMethod, promoCode, appliedPromo: appliedPromo ?? "" };
  useLocaleDraft("checkout-choices", checkoutChoices, (update) => {
    const next = typeof update === "function" ? update(checkoutChoices) : update;
    if (["AIRWALLEX"].includes(next.paymentMethod)) setPaymentMethod(next.paymentMethod);
    setPromoCode(next.promoCode); setAppliedPromo(next.appliedPromo || null);
  }, ["paymentMethod", "promoCode", "appliedPromo"]);
  const [promoFeedback, setPromoFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  const [preview, setPreview] = useState<CheckoutPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  // Bumping this token forces the preview effect to re-fetch even when
  // none of its other deps changed (e.g. after a manual retry).
  const [previewToken, setPreviewToken] = useState(0);

  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  useLocaleSwitchGuard(isPlacingOrder);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submitInFlightRef = useRef(false);
  const checkoutIdempotencyAttemptRef =
    useRef<CheckoutIdempotencyAttempt | null>(null);
  const [savedCheckoutAttempt, setSavedCheckoutAttempt] = useState<CheckoutIdempotencyAttempt | null>(null);
  const attemptDraft = savedCheckoutAttempt ?? { fingerprint: "", key: "" };
  useLocaleDraft("checkout-idempotency", attemptDraft, (update) => {
    const next = typeof update === "function" ? update(attemptDraft) : update;
    if (next.fingerprint && /^[0-9a-f-]{36}$/i.test(next.key)) {
      checkoutIdempotencyAttemptRef.current = next;
      setSavedCheckoutAttempt(next);
    }
  }, ["fingerprint", "key"]);

  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof CustomerFormState, string>>
  >({});

  // Profile auto-fill lifecycle. Kept separate from the preview state so
  // the form can show its own loading/error affordances. `profileToken`
  // lets the user retry a failed profile load.
  const [profileStatus, setProfileStatus] = useState<
    "idle" | "loading" | "loaded" | "error"
  >("idle");
  const [profileToken, setProfileToken] = useState(0);

  // Hydrate the form from the authenticated user's saved profile. The
  // database profile is the source of truth (not Redux/localStorage), so
  // we refetch it whenever auth resolves or the user retries. Email is
  // always taken from the profile and locked; the editable shipping
  // fields only backfill when empty so a refetch never clobbers typing.
  useEffect(() => {
    if (authStatus === "loading") return;
    if (authStatus !== "authenticated") return;

    let ignore = false;

    void (async () => {
      // setState calls live inside the async closure (microtask) so the
      // lint rule against synchronous effect-body setState is satisfied,
      // matching the preview effect below.
      setProfileStatus("loading");

      const profile = await fetchCheckoutProfile();
      if (ignore) return;

      if (!profile) {
        setProfileStatus("error");
        return;
      }

      setForm((prev) => ({
        ...prev,
        // Identity-bound: always reflect the DB/session email, never
        // preserve a stale typed value (the field is read-only anyway).
        customerEmail: profile.email ?? session?.user?.email ?? "",
        // Shipping fields: backfill only when the user hasn't typed yet.
        customerName: prev.customerName || profile.name || "",
        customerPhone: prev.customerPhone || profile.phone || "",
        customerCity: prev.customerCity || profile.city || "",
        customerAddress: prev.customerAddress || profile.address || "",
        customerPostalCode:
          prev.customerPostalCode || profile.postalCode || "",
      }));
      setProfileStatus("loaded");
    })();

    return () => {
      ignore = true;
    };
  }, [authStatus, session?.user?.email, profileToken]);

  const handleRetryProfile = useCallback(
    () => setProfileToken((token) => token + 1),
    [],
  );

  // Build the items payload sent to /api/checkout/preview.
  // Buy Now and selected-cart flows forward explicit items. Full-cart
  // signed-in checkout omits `items` so the server reads the persisted cart.
  // Guests send their local cart choices; pricing always comes from the server.
  const buildItemsPayload = useCallback((): CheckoutItemInput[] | undefined => {
    if (source.kind !== "cart") return source.items;
    if (authStatus === "unauthenticated") {
      return items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        ...(item.variantId ? { variantId: item.variantId } : {}),
      }));
    }
    return undefined;
  }, [source, authStatus, items]);

  const cartSourceReady =
    source.kind !== "cart" ||
    (cartIsHydrated &&
      !cartIsLoading &&
      (authStatus === "unauthenticated" || cartMode === "server"));

  // Single source of truth for "fetch the preview". Triggered by:
  //   - a delivery area being selected
  //   - auth status becoming known
  //   - the items source changing (cart -> buy-now and vice versa)
  //   - the applied promo code changing
  //   - the manual reload token bumping
  // Anything that should refresh totals just updates one of those inputs.
  useEffect(() => {
    if (authStatus === "loading") return;
    if (!cartSourceReady) {
      if (
        source.kind === "cart" &&
        cartIsHydrated &&
        !cartIsLoading &&
        cartError
      ) {
        void (async () => {
          setPreview(null);
          setPreviewLoading(false);
          setPreviewError(cartError);
        })();
      }
      return;
    }

    const deliveryZone = form.deliveryZone;
    if (!deliveryZone) {
      void (async () => {
        setPreview(null);
        setPreviewLoading(false);
        setPreviewError(null);
      })();
      return;
    }

    let ignore = false;

    void (async () => {
      const query = searchParams.toString();
      const checkoutEventId = getNavigationEventId(
        "checkout",
        query ? `/checkout?${query}` : "/checkout",
      );
      // setState calls live inside the async closure (microtask) so the
      // lint rule against synchronous effect-body setState is satisfied.
      setPreviewLoading(true);
      setPreviewError(null);

      try {
        const next = await fetchCheckoutPreview({
          items: buildItemsPayload(),
          deliveryZone,
          promoCode: appliedPromo,
        });
        if (ignore) return;

        setPreview(next);
        // One accepted, server-priced preview starts a checkout attempt for
        // Buy Now, selected cart, and the profile/full-cart link alike.
        // Pricing refreshes and effect replay reuse this navigation identity.
        trackInitiateCheckout(
          {
            items: next.items,
            currency: next.summary.currency,
            value: next.summary.total,
          },
          checkoutEventId,
        );


        if (appliedPromo && next.promo) {
          if (next.promo.ok) {
            setPromoFeedback({
              tone: "success",
              message: `${next.promo.code} applied.`,
            });
            toast.success(i18n(`Promo code ${next.promo.code} applied`));
          } else {
            setAppliedPromo(null);
            setPromoFeedback({ tone: "error", message: next.promo.reason });
            toast.error(i18n(next.promo.reason));
          }
        }
      } catch (error) {
        if (ignore) return;
        const message =
          error instanceof Error
            ? error.message
            : "Failed to load order summary.";
        setPreviewError(message);
        setPreview(null);
      } finally {
        if (!ignore) setPreviewLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [
    i18n,
    authStatus,
    cartError,
    cartIsHydrated,
    cartIsLoading,
    cartSourceReady,
    source,
    appliedPromo,
    previewToken,
    buildItemsPayload,
    form.deliveryZone,
    searchParams,
  ]);

  const handleApplyPromo = () => {
    const trimmed = promoCode.trim().toUpperCase();
    if (!trimmed) return;
    setPromoFeedback(null);
    setAppliedPromo(trimmed);
    // The preview effect will pick up the new appliedPromo and refetch.
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoCode("");
    setPromoFeedback(null);
    toast.info(i18n("Promo code removed"));
  };

  const handleRetry = () => setPreviewToken((token) => token + 1);

  const validateForm = (): boolean => {
    const errors: typeof fieldErrors = {};
    if (form.customerName.trim().length < 2) {
      errors.customerName = i18n("Enter your full name.");
    }
    if (form.customerPhone.trim().length < 7) {
      errors.customerPhone = i18n("Enter a valid phone number.");
    }
    if (authStatus === "unauthenticated" && form.customerEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.customerEmail.trim())) {
      errors.customerEmail = i18n("Enter a valid email address.");
    }
    if (form.customerAddress.trim().length < 5) {
      errors.customerAddress = i18n("Enter your delivery address.");
    }
    if (form.customerCity.trim() && form.customerCity.trim().length < 2) {
      errors.customerCity = i18n("City / district is too short.");
    }
    if (
      form.customerPostalCode.trim() &&
      form.customerPostalCode.trim().length < 3
    ) {
      errors.customerPostalCode = i18n("Postal code is too short.");
    }
    if (form.customerNote.length > 1000) {
      errors.customerNote = i18n("Note is too long.");
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const syncCartAfterOrder = async () => {
    if (source.kind === "buy-now") return;

    const removePurchasedLocalItems = () => {
      const remainingItems =
        source.kind === "cart"
          ? []
          : items.filter(
              (cartItem) =>
                !source.items.some((orderedItem) =>
                  orderedItem.variantId
                    ? orderedItem.variantId === cartItem.variantId
                    : orderedItem.productId === cartItem.productId,
                ),
            );
      writeLocalCart(remainingItems);
      dispatch(
        setCartData({
          items: remainingItems,
          summary: computeCartSummary(remainingItems),
        }),
      );
    };

    if (authStatus === "unauthenticated") {
      removePurchasedLocalItems();
      dispatch(setCartError(null));
      return;
    }

    try {
      const snapshot = await fetchServerCartSnapshot();
      writeLocalCart(snapshot.items);
      dispatch(setCartData(snapshot));
    } catch {
      removePurchasedLocalItems();
    }
    dispatch(setCartError(null));
  };

  const handlePlaceOrder = async () => {
    if (
      isPlacingOrder ||
      submitInFlightRef.current ||
      previewLoading ||
      !cartSourceReady
    ) {
      return;
    }
    setSubmitError(null);

    const deliveryZone = form.deliveryZone;
    if (!deliveryZone) {
      setFieldErrors((current) => ({ ...current, deliveryZone: "Select a delivery area." }));
      toast.warning(i18n("Select a delivery area."));
      return;
    }

    if (!preview || preview.items.length === 0) {
      const msg = i18n("Your cart is empty. Add items before checking out.");
      setSubmitError(msg);
      toast.error(i18n(msg));
      return;
    }
    if (
      paymentMethod === "AIRWALLEX" &&
      !preview.airwallexPaymentQuote?.quoteToken
    ) {
      const msg = i18n("Refresh checkout to obtain a secure payment quote.");
      setSubmitError(msg);
      toast.error(i18n(msg));
      return;
    }

    if (!validateForm()) {
      toast.warning(i18n("Please fill in all required fields."));
      return;
    }

    submitInFlightRef.current = true;
    setIsPlacingOrder(true);
    let leavingCheckout = false;
    let reservedAirwallexOrderId: string | null = null;

    try {
      const checkoutRequest: PlaceOrderRequest = {
        items: buildItemsPayload(),
        customerName: form.customerName.trim(),
        customerPhone: form.customerPhone.trim(),
        // Signed-in email remains account-bound on the server. Guests may
        // provide a contact email without creating or claiming an account.
        ...(authStatus === "unauthenticated"
          ? { customerEmail: form.customerEmail.trim() || undefined }
          : {}),
        customerAddress: form.customerAddress.trim(),
        customerCity: form.customerCity.trim() || undefined,
        deliveryZone,
        customerPostalCode: form.customerPostalCode.trim() || undefined,
        customerNote: form.customerNote.trim() || undefined,
        paymentMethod,
        promoCode: appliedPromo,
        clearCart: source.kind !== "buy-now",
        ...(paymentMethod === "AIRWALLEX"
          ? {
              airwallexQuoteToken:
                preview.airwallexPaymentQuote?.quoteToken,
            }
          : {}),
      };

      // A refreshed signed quote authenticates the same choices. It must not
      // rotate a request key after an uncertain payment-initiation response.
      const fingerprintRequest = { ...checkoutRequest };
      delete fingerprintRequest.airwallexQuoteToken;
      const attempt = resolveCheckoutIdempotencyAttempt(
        checkoutIdempotencyAttemptRef.current,
        JSON.stringify(fingerprintRequest),
        () => window.crypto.randomUUID(),
      );
      checkoutIdempotencyAttemptRef.current = attempt;
      setSavedCheckoutAttempt(attempt);
      checkoutRequest.idempotencyKey = attempt.key;

      const result = await placeCheckoutOrder(checkoutRequest);
      // A full-cart order empties the cart; a selected-cart order removes
      // only the purchased lines. Keep Redux and local storage authoritative.
      await syncCartAfterOrder();

      if (paymentMethod === "AIRWALLEX") {
        reservedAirwallexOrderId = result.order.id;
        toast.info(i18n("Opening Airwallex secure checkout..."));
        await startAirwallexHostedCheckout(result.order.id);
        leavingCheckout = true;
        return;
      }

      toast.success(i18n("Order placed successfully!"));
      leavingCheckout = true;
      router.push(`/orders/${result.order.id}?just-placed=1`);
    } catch (error) {
      if (reservedAirwallexOrderId) {
        toast.info(
          i18n("Your order is reserved. Open it to retry the secure payment."),
        );
        leavingCheckout = true;
        router.push(
          `/orders/${reservedAirwallexOrderId}?payment=failed`,
        );
        return;
      }
      if (
        error instanceof CheckoutSubmissionError &&
        error.orderId &&
        paymentMethod === "AIRWALLEX"
      ) {
        await syncCartAfterOrder();
        const outcome =
          error.paymentState === "PENDING" ||
          error.paymentState === "SUCCESS"
            ? "processing"
            : "failed";
        toast.info(
          i18n(outcome === "processing"
            ? "Your order is safe while payment status is checked."
            : "The payment attempt ended. Review the order for details."),
        );
        leavingCheckout = true;
        router.push(`/orders/${error.orderId}?payment=${outcome}`);
        return;
      }
      const message =
        error instanceof Error ? error.message : "Failed to place the order.";
      if (error instanceof CheckoutSubmissionError) {
        setFieldErrors(
          Object.fromEntries(
            Object.entries(error.fieldErrors).filter(([field]) =>
              Object.prototype.hasOwnProperty.call(EMPTY_FORM, field),
            ),
          ),
        );
      }
      setSubmitError(message);
      toast.error(i18n(message));
    } finally {
      if (!leavingCheckout) {
        submitInFlightRef.current = false;
        setIsPlacingOrder(false);
      }
    }
  };

  const isEmpty =
    cartSourceReady &&
    !previewLoading &&
    (preview ? preview.items.length === 0 : source.kind === "cart" && items.length === 0);
  const isAuthenticated = authStatus === "authenticated";

  // Resolve the session before deciding whether to load a saved profile/cart.
  if (authStatus === "loading") {
    return (
      <FullPageLoader
        title={i18n("Loading checkout...")}
        message={i18n("One moment while we prepare your checkout.")}
      />
    );
  }

  return (
    <main className="min-h-screen bg-brand-light-bg">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <CheckoutHeader
          isAuthenticated={isAuthenticated}
          itemCount={
            (preview?.items ?? (source.kind === "cart" ? items : source.items))
              .reduce((sum, item) => sum + item.quantity, 0)
          }
          source={source.kind}
          loginHref={`/login?callbackUrl=${encodeURIComponent(
            searchParams.toString()
              ? `/checkout?${searchParams.toString()}`
              : "/checkout",
          )}`}
        />

        {previewError && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <span>{i18n(previewError)}</span>
            <button
              type="button"
              onClick={handleRetry}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700"
            >
              {i18n("Retry")}</button>
          </div>
        )}

        {isEmpty ? (
          <div className="mt-8 rounded-3xl border border-brand-border bg-brand-white p-10 text-center shadow-sm">
            <p className="text-lg font-semibold text-gray-900">
              {i18n("Nothing to check out yet")}</p>
            <p className="mt-2 text-sm text-gray-600">
              {i18n("Add a few products to your cart, then come back to complete the order.")}</p>
            <Link
              href="/products"
              className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-brand-red px-5 py-2.5 text-sm font-bold text-brand-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-red-hover hover:shadow-xl"
            >
              {i18n("Browse products")}</Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-8">
            <fieldset
              data-locale-recoverable
              disabled={isPlacingOrder}
              className="flex min-w-0 flex-col gap-5"
            >
              <CustomerForm
                form={form}
                onChange={(field, value) => {
                  setForm((prev) => ({ ...prev, [field]: value }));
                  if (field === "deliveryZone") {
                    setPreview(null);
                    setPreviewLoading(Boolean(value));
                  }
                  if (fieldErrors[field]) {
                    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
                  }
                }}
                errors={fieldErrors}
                isAuthenticated={isAuthenticated}
                emailRequired={false}
                profileStatus={profileStatus}
                onRetryProfile={handleRetryProfile}
              />

              <PaymentMethodPicker
                airwallexEnabled={
                  // Show the payment choice while waiting for the first quote.
                  preview?.availablePaymentMethods.includes("AIRWALLEX") ??
                  true
                }
              />

              {form.deliveryZone && (
                <CheckoutItemsCard
                  items={preview?.items ?? []}
                  currency={preview?.summary.currency ?? BASE_CURRENCY}
                  isLoading={previewLoading && !preview}
                />
              )}
            </fieldset>

            <div className="lg:sticky lg:top-[88px] lg:self-start">
              <OrderSummaryCard
                deliveryAreaSelected={Boolean(form.deliveryZone)}
                summary={preview?.summary ?? null}
                isLoading={previewLoading || !cartSourceReady}
                items={items}
                promoCode={promoCode}
                appliedPromo={appliedPromo}
                onPromoCodeChange={setPromoCode}
                onApplyPromo={handleApplyPromo}
                onRemovePromo={handleRemovePromo}
                promoFeedback={promoFeedback}
                onPlaceOrder={handlePlaceOrder}
                isPlacing={isPlacingOrder}
                submitError={submitError}
                paymentMethod={paymentMethod}
                airwallexPaymentQuote={preview?.airwallexPaymentQuote ?? null}
              />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<CheckoutPageSkeleton />}>
      <CheckoutPageInner />
    </Suspense>
  );
}
