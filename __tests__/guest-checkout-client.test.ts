import { createTranslator as createIntlTranslator } from "next-intl";
import coreMessages from "@/messages/core-en.json";
import interfaceMessages from "@/messages/interface-en.json";
import adminMessages from "@/messages/admin-en.json";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CartItem } from "@/features/cart/api";
import type { CheckoutPreview, PlaceOrderRequest } from "@/features/checkout/api";
import { CheckoutSubmissionError } from "@/features/checkout/api";
import type { CustomerFormState } from "@/app/(shop)/checkout/components/CustomerForm";

// Run the checkout's real event handlers and effects with a deterministic
// scheduler, matching the existing checkout analytics tests' node environment.
const harness = vi.hoisted(() => ({
  states: [] as unknown[],
  refs: [] as { current: unknown }[],
  stateCursor: 0,
  refCursor: 0,
  effects: [] as Array<() => void | (() => void)>,
  authStatus: "unauthenticated",
  query: "",
  cart: { items: [] as CartItem[], mode: "local", isHydrated: true, isLoading: false, error: null },
  fetchPreview: vi.fn(),
  fetchProfile: vi.fn(),
  placeOrder: vi.fn<(body: PlaceOrderRequest) => Promise<unknown>>(),
  fetchCart: vi.fn(),
  writeCart: vi.fn(),
  dispatch: vi.fn(),
  router: { push: vi.fn(), replace: vi.fn() },
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = harness.stateCursor++;
    if (index >= harness.states.length) harness.states.push(typeof initial === "function" ? initial() : initial);
    return [harness.states[index], (next: unknown) => {
      harness.states[index] = typeof next === "function" ? next(harness.states[index]) : next;
    }];
  },
  useRef: (initial: unknown) => {
    const index = harness.refCursor++;
    if (index >= harness.refs.length) harness.refs.push({ current: initial });
    return harness.refs[index];
  },
  useEffect: (effect: () => void | (() => void)) => { harness.effects.push(effect); },
  useMemo: (compute: () => unknown) => compute(),
  useCallback: (callback: unknown) => callback,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => harness.router,
  useSearchParams: () => new URLSearchParams(harness.query),
}));
vi.mock("next/link", () => ({ default: () => null }));
vi.mock("@/lib/auth/use-app-session", () => ({
  useSession: () => ({ data: { user: { id: "user-1", email: "account@example.test" } }, status: harness.authStatus }),
}));
vi.mock("react-redux", () => ({
  useDispatch: () => harness.dispatch,
  useSelector: (selector: (state: { cart: typeof harness.cart }) => unknown) => selector({ cart: harness.cart }),
}));
vi.mock("@/features/checkout/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/checkout/api")>()),
  fetchCheckoutPreview: harness.fetchPreview,
  fetchCheckoutProfile: harness.fetchProfile,
  placeCheckoutOrder: harness.placeOrder,
}));
vi.mock("@/features/cart/api", () => ({ fetchServerCartSnapshot: harness.fetchCart }));
vi.mock("@/features/cart/storage", () => ({ writeLocalCart: harness.writeCart }));
vi.mock("@/lib/analytics/meta-pixel", () => ({ getNavigationEventId: () => "checkout-1", trackInitiateCheckout: vi.fn() }));
vi.mock("@/lib/airwallex/components/AirwallexPayButton", () => ({ startAirwallexHostedCheckout: vi.fn() }));
vi.mock("@/lib/feedback", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }));
vi.mock("@/components/ui/loading", () => ({ CheckoutPageSkeleton: () => null, FullPageLoader: () => null }));
vi.mock("@/app/(shop)/checkout/components/CheckoutHeader", () => ({ default: () => null }));
vi.mock("@/app/(shop)/checkout/components/CheckoutItemsCard", () => ({ default: () => null }));
vi.mock("@/app/(shop)/checkout/components/CustomerForm", () => ({ default: () => null }));
vi.mock("@/app/(shop)/checkout/components/PaymentMethodPicker", () => ({ default: () => null }));
vi.mock("@/app/(shop)/checkout/components/OrderSummaryCard", () => ({ default: () => null }));

const cartItem: CartItem = {
  id: "local:variant-1", productId: "product-1", variantId: "variant-1", name: "Product",
  image: null, quantity: 2, unitPrice: 100, originalPrice: 100, lineTotal: 200,
  stock: 10, status: "ACTIVE",
};

const preview: CheckoutPreview = {
  items: [{
    productId: "product-1", variantId: "variant-1", sku: null, variantKey: "default", variantName: null,
    modelNumber: null, color: null, size: null, attributes: null, attributeSummary: null,
    name: "Product", image: null, quantity: 2, unitPrice: 100, originalPrice: 100,
    lineTotal: 200, lineSavings: 0, baseUnitPrice: 100, baseOriginalPrice: 100,
    baseLineTotal: 200, baseLineSavings: 0, stock: 10,
  }],
  summary: {
    subtotal: 200, totalSavings: 0, totalSaved: 0, discount: 0, shipping: 60, tax: 0,
    total: 260, taxRate: 0, freeShippingThreshold: 1000, shippingFee: 60,
    isOutsideDhaka: false, isFreeShippingApplied: false, currency: "USD", baseCurrency: "USD",
    baseSubtotal: 200, baseTotalSavings: 0, baseTotalSaved: 0, baseDiscount: 0,
    baseShipping: 60, baseTax: 0, baseTotal: 260, baseFreeShippingThreshold: 1000,
    baseShippingFee: 60, exchangeRate: "1", exchangeRateTimestamp: null,
  },
  promo: null, airwallexPaymentQuote: { baseCurrency: "USD", baseAmount: 260, displayCurrency: "USD", paymentCurrency: "USD", paymentAmount: 260, exchangeRate: "1", exchangeRateTimestamp: "2026-10-04T06:00:00.000Z", quoteToken: "signed-quote" }, availablePaymentMethods: ["AIRWALLEX"],
};

function findProps(node: ReactNode, key: string): Record<string, unknown> {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findProps(child, key);
      if (key in found) return found;
    }
  }
  if (isValidElement<Record<string, unknown> & { children?: ReactNode }>(node)) {
    if (key in node.props) return node.props;
    return findProps(node.props.children, key);
  }
  return {};
}

async function renderCheckout(runEffects = false) {
  harness.stateCursor = 0;
  harness.refCursor = 0;
  harness.effects = [];
  const { default: CheckoutPage } = await import("@/app/(shop)/checkout/page");
  const outer = CheckoutPage() as ReactElement<{ children: ReactElement }>;
  const inner = outer.props.children.type as () => ReactElement;
  const tree = inner();
  if (runEffects) {
    harness.effects.forEach((effect) => effect());
    await Promise.resolve();
    await Promise.resolve();
  }
  return tree;
}

async function chooseDeliveryArea(deliveryZone: CustomerFormState["deliveryZone"] = "INSIDE_DHAKA") {
  const tree = await renderCheckout();
  const onChange = findProps(tree, "form").onChange as (key: keyof CustomerFormState, value: string) => void;
  onChange("deliveryZone", deliveryZone);
  await renderCheckout(true);
  return renderCheckout();
}

async function fillDeliveryDetails(
  email = "guest@example.test",
  deliveryZone: CustomerFormState["deliveryZone"] = "INSIDE_DHAKA",
) {
  let tree = await renderCheckout();
  const onChange = findProps(tree, "form").onChange as (key: keyof CustomerFormState, value: string) => void;
  onChange("customerName", " Guest Buyer ");
  onChange("customerPhone", " 01700000000 ");
  onChange("customerAddress", " 12 Main Road ");
  onChange("customerEmail", email);
  onChange("deliveryZone", deliveryZone);
  await renderCheckout(true);
  tree = await renderCheckout();
  return findProps(tree, "onPlaceOrder").onPlaceOrder as () => Promise<void>;
}

beforeEach(() => {
  harness.states = [];
  harness.refs = [];
  harness.authStatus = "unauthenticated";
  harness.query = "";
  harness.cart = { items: [cartItem], mode: "local", isHydrated: true, isLoading: false, error: null };
  harness.fetchPreview.mockReset().mockResolvedValue(preview);
  harness.fetchProfile.mockReset().mockResolvedValue({ name: "Account Buyer", email: "account@example.test" });
  harness.placeOrder.mockReset().mockResolvedValue({ order: { id: "order-1", orderNumber: "ORDER-1" } });
  harness.fetchCart.mockReset().mockResolvedValue({ items: [], summary: { totalItems: 0, subtotal: 0, totalDiscount: 0, finalTotal: 0 } });
  harness.writeCart.mockClear();
  harness.dispatch.mockClear();
  harness.router.push.mockClear();
  harness.router.replace.mockClear();
  vi.stubGlobal("window", { crypto: { randomUUID: () => "8d2414af-e2cb-4a19-a6d8-16d0168ee775" } });
});

afterEach(() => vi.unstubAllGlobals());

describe("guest checkout event handlers", () => {
  it("keeps the guest delivery form available without pricing an assumed delivery area", async () => {
    await renderCheckout(true);
    const tree = await renderCheckout();

    expect(findProps(tree, "form").form).toMatchObject({ deliveryZone: "" });
    expect(findProps(tree, "summary").summary).toBeNull();
    expect(findProps(tree, "summary").deliveryAreaSelected).toBe(false);
    expect(findProps(tree, "summary").isLoading).toBe(false);
    expect(findProps(tree, "airwallexEnabled").airwallexEnabled).toBe(true);
    expect(harness.fetchPreview).not.toHaveBeenCalled();
    expect(harness.fetchProfile).not.toHaveBeenCalled();
  });

  it("requires an explicit delivery area before submission rather than reporting an empty cart", async () => {
    const submit = await fillDeliveryDetails("guest@example.test", "");
    await submit();
    const tree = await renderCheckout();

    expect(harness.fetchPreview).not.toHaveBeenCalled();
    expect(harness.placeOrder).not.toHaveBeenCalled();
    expect(findProps(tree, "form").errors).toMatchObject({
      deliveryZone: expect.stringMatching(/select.*delivery area/i),
    });
    expect(findProps(tree, "onPlaceOrder").submitError ?? "").not.toContain("Your cart is empty");
  });

  it("waits for explicit selection even when the signed-in profile contains a Dhaka address", async () => {
    harness.authStatus = "authenticated";
    harness.cart.mode = "server";
    harness.fetchProfile.mockResolvedValue({
      name: "Account Buyer", email: "account@example.test", phone: "01700000000",
      address: "12 Main Road", city: "Dhaka", deliveryZone: "INSIDE_DHAKA",
    });
    await renderCheckout(true);
    const tree = await renderCheckout();

    expect(harness.fetchProfile).toHaveBeenCalledTimes(1);
    expect(findProps(tree, "form").form).toMatchObject({
      customerName: "Account Buyer", customerAddress: "12 Main Road", customerCity: "Dhaka", deliveryZone: "",
    });
    expect(harness.fetchPreview).not.toHaveBeenCalled();
    const submit = findProps(tree, "onPlaceOrder").onPlaceOrder as () => Promise<void>;
    await submit();
    expect(harness.placeOrder).not.toHaveBeenCalled();
  });

  it("forwards the explicitly selected outside-Dhaka area to both pricing and order placement", async () => {
    const submit = await fillDeliveryDetails("guest@example.test", "OUTSIDE_DHAKA");

    expect(harness.fetchPreview).toHaveBeenCalledWith(expect.objectContaining({ deliveryZone: "OUTSIDE_DHAKA" }));
    await submit();
    expect(harness.placeOrder).toHaveBeenCalledWith(expect.objectContaining({ deliveryZone: "OUTSIDE_DHAKA" }));
  });

  it("clears the prior quote and blocks payment while a newly chosen delivery area is being priced", async () => {
    await fillDeliveryDetails();
    let finishPreview!: (result: CheckoutPreview) => void;
    harness.fetchPreview.mockImplementation(() => new Promise((resolve) => { finishPreview = resolve; }));
    const onChange = findProps(await renderCheckout(), "form").onChange as (key: keyof CustomerFormState, value: string) => void;
    onChange("deliveryZone", "OUTSIDE_DHAKA");
    await renderCheckout(true);
    let tree = await renderCheckout();

    expect(findProps(tree, "summary").summary).toBeNull();
    expect(findProps(tree, "summary").isLoading).toBe(true);
    const submit = findProps(tree, "onPlaceOrder").onPlaceOrder as () => Promise<void>;
    await submit();
    expect(harness.placeOrder).not.toHaveBeenCalled();

    finishPreview({ ...preview, summary: { ...preview.summary, isOutsideDhaka: true, shipping: 120, total: 320 } });
    await Promise.resolve();
    await Promise.resolve();
    tree = await renderCheckout();
    const submitWithNewQuote = findProps(tree, "onPlaceOrder").onPlaceOrder as () => Promise<void>;
    await submitWithNewQuote();
    expect(harness.placeOrder).toHaveBeenCalledWith(expect.objectContaining({ deliveryZone: "OUTSIDE_DHAKA" }));
  });

  it("submits normalized guest choices with an Airwallex attempt key", async () => {
    const submit = await fillDeliveryDetails();
    await submit();
    expect(harness.placeOrder).toHaveBeenCalledWith(expect.objectContaining({
      items: [{ productId: "product-1", variantId: "variant-1", quantity: 2 }],
      customerName: "Guest Buyer", customerPhone: "01700000000", customerAddress: "12 Main Road",
      customerEmail: "guest@example.test", paymentMethod: "AIRWALLEX",
      idempotencyKey: "8d2414af-e2cb-4a19-a6d8-16d0168ee775",
    }));
    expect(harness.fetchProfile).not.toHaveBeenCalled();
    expect(harness.fetchCart).not.toHaveBeenCalled();
    expect(harness.writeCart).toHaveBeenCalledWith([]);
    expect(harness.router.push).not.toHaveBeenCalled();
  });

  it("allows a guest to leave email empty and rejects an invalid supplied email", async () => {
    let submit = await fillDeliveryDetails("invalid-email");
    await submit();
    expect(harness.placeOrder).not.toHaveBeenCalled();
    const tree = await renderCheckout();
    expect(findProps(tree, "form").errors).toMatchObject({ customerEmail: "Enter a valid email address." });
    const onChange = findProps(tree, "form").onChange as (key: keyof CustomerFormState, value: string) => void;
    onChange("customerEmail", "");
    submit = findProps(await renderCheckout(), "onPlaceOrder").onPlaceOrder as () => Promise<void>;
    await submit();
    expect(harness.placeOrder).toHaveBeenCalledWith(expect.objectContaining({ customerEmail: undefined }));
  });

  it("rejects missing required delivery details before creating an order", async () => {
    const submit = findProps(await chooseDeliveryArea(), "onPlaceOrder").onPlaceOrder as () => Promise<void>;
    await submit();
    expect(harness.placeOrder).not.toHaveBeenCalled();
    expect(findProps(await renderCheckout(), "form").errors).toMatchObject({
      customerName: "Enter your full name.", customerPhone: "Enter a valid phone number.",
      customerAddress: "Enter your delivery address.",
    });
  });

  it("blocks concurrent clicks and keeps the lock through successful navigation", async () => {
    let finish!: (value: unknown) => void;
    harness.placeOrder.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const submit = await fillDeliveryDetails();
    const first = submit();
    await submit();
    expect(harness.placeOrder).toHaveBeenCalledTimes(1);
    finish({ order: { id: "order-1", orderNumber: "ORDER-1" } });
    await first;
    await submit();
    expect(harness.placeOrder).toHaveBeenCalledTimes(1);
  });

  it("keeps the local cart and reuses the attempt key after a failed response", async () => {
    harness.placeOrder.mockRejectedValueOnce(new Error("Connection interrupted"));
    let submit = await fillDeliveryDetails();
    await submit();
    expect(harness.writeCart).not.toHaveBeenCalled();
    expect(harness.router.push).not.toHaveBeenCalled();
    submit = findProps(await renderCheckout(), "onPlaceOrder").onPlaceOrder as () => Promise<void>;
    await submit();
    expect(harness.placeOrder).toHaveBeenCalledTimes(2);
    expect(harness.placeOrder.mock.calls[0][0].idempotencyKey).toBe(harness.placeOrder.mock.calls[1][0].idempotencyKey);
  });

  it("keeps the attempt key when the same Airwallex choices receive a refreshed signed quote", async () => {
    const randomUUID = vi.fn()
      .mockReturnValueOnce("8d2414af-e2cb-4a19-a6d8-16d0168ee775")
      .mockReturnValueOnce("75fd6be4-6504-4a69-9fae-d38a145ccebe");
    vi.stubGlobal("window", { crypto: { randomUUID } });
    const onlinePreview: CheckoutPreview = {
      ...preview,
      availablePaymentMethods: ["AIRWALLEX", "AIRWALLEX"],
      airwallexPaymentQuote: {
        baseCurrency: "USD", baseAmount: 260, displayCurrency: "USD", paymentCurrency: "USD",
        paymentAmount: 2.6, exchangeRate: "0.01", exchangeRateTimestamp: "2026-10-06T00:00:00.000Z",
        quoteToken: "signed-quote-one",
      },
    };
    harness.fetchPreview.mockResolvedValue(onlinePreview);
    harness.placeOrder.mockRejectedValueOnce(new Error("Connection interrupted"));
    await fillDeliveryDetails();
    let submit = findProps(await renderCheckout(), "onPlaceOrder").onPlaceOrder as () => Promise<void>;
    await submit();
    harness.fetchPreview.mockResolvedValue({
      ...onlinePreview,
      airwallexPaymentQuote: { ...onlinePreview.airwallexPaymentQuote!, quoteToken: "signed-quote-two" },
    });
    await renderCheckout(true);
    submit = findProps(await renderCheckout(), "onPlaceOrder").onPlaceOrder as () => Promise<void>;
    await submit();
    expect(harness.placeOrder).toHaveBeenCalledTimes(2);
    expect(harness.placeOrder.mock.calls[0][0].airwallexQuoteToken).toBe("signed-quote-one");
    expect(harness.placeOrder.mock.calls[1][0].airwallexQuoteToken).toBe("signed-quote-two");
    expect(harness.placeOrder.mock.calls[0][0].idempotencyKey).toBe(harness.placeOrder.mock.calls[1][0].idempotencyKey);
    expect(randomUUID).toHaveBeenCalledTimes(1);
  });

  it("shows server delivery validation beside the matching form field", async () => {
    harness.placeOrder.mockRejectedValueOnce(new CheckoutSubmissionError("Review delivery details.", {
      orderId: null, paymentState: null,
      fieldErrors: { customerPhone: "Enter a valid phone number.", internalField: "Ignored" },
    }));
    const submit = await fillDeliveryDetails();
    await submit();
    expect(findProps(await renderCheckout(), "form").errors).toEqual({ customerPhone: "Enter a valid phone number." });
  });

  it("removes only selected guest cart variants after checkout", async () => {
    harness.query = "source=cart&buy=product-1:2:variant-1";
    const otherVariant = { ...cartItem, id: "local:variant-2", variantId: "variant-2" };
    harness.cart.items.push(otherVariant);
    const submit = await fillDeliveryDetails();
    await submit();
    expect(harness.writeCart).toHaveBeenCalledWith([otherVariant]);
    expect(harness.fetchCart).not.toHaveBeenCalled();
  });

  it("preserves profile-backed checkout and protected server-cart syncing for signed-in users", async () => {
    harness.authStatus = "authenticated";
    harness.cart.mode = "server";
    const submit = await fillDeliveryDetails("attempted-override@example.test");
    await submit();
    expect(harness.fetchProfile).toHaveBeenCalledTimes(1);
    const request = harness.placeOrder.mock.calls[0][0];
    expect(request.items).toBeUndefined();
    expect(request).not.toHaveProperty("customerEmail");
    expect(harness.fetchCart).toHaveBeenCalledTimes(1);
  });
});

vi.mock("next-intl", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next-intl")>()),
  useLocale: () => "en",
  useTranslations: () => createIntlTranslator({ locale: "en", messages: { ...coreMessages, ...interfaceMessages, ...adminMessages } }),
}));
vi.mock("@/components/i18n/useLocaleDraft", () => ({ useLocaleDraft: () => undefined, useLocaleSwitchGuard: () => undefined }));
vi.mock("@/lib/i18n/navigation", async () => ({ ...(await import("next/navigation")), default: (await import("next/link")).default }));
