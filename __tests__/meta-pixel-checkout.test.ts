import { createTranslator as createIntlTranslator } from "next-intl";
import coreMessages from "@/messages/core-en.json";
import interfaceMessages from "@/messages/interface-en.json";
import adminMessages from "@/messages/admin-en.json";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CartItem } from "@/features/cart/api";
import type { CheckoutPreview, DeliveryZone, PreviewRequest } from "@/features/checkout/api";
import type { OrderDetail } from "@/features/orders/api";

// Execute the actual preview effect in the existing node test environment.
// Presentation and React's scheduler are stubbed; analytics delivery stays real.
const harness = vi.hoisted(() => ({
  effects: [] as Array<() => void | (() => void)>,
  query: "",
  authStatus: "authenticated",
  deliveryZone: "INSIDE_DHAKA" as DeliveryZone | "",
  readyOrder: null as OrderDetail | null,
  sessionUserId: "owner-1" as string | undefined,
  store: {
    cart: {
      items: [] as CartItem[],
      mode: "server",
      isHydrated: true,
      isLoading: false,
      error: null,
    },
  },
  fetchPreview: vi.fn<(body: PreviewRequest) => Promise<CheckoutPreview>>(),
  fetchProfile: vi.fn().mockResolvedValue(null),
  fetchOrder: vi.fn().mockResolvedValue(null),
  router: { push: vi.fn(), replace: vi.fn() },
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useEffect: (effect: () => void | (() => void)) => { harness.effects.push(effect); },
  useState: (initial: unknown) => {
    const value = typeof initial === "function" ? initial() : initial;
    const state = harness.readyOrder && typeof value === "object" && value && "status" in value && value.status === "loading"
      ? { status: "ready", order: harness.readyOrder }
      : typeof value === "object" && value && "deliveryZone" in value
        ? { ...value, deliveryZone: harness.deliveryZone }
        : value;
    return [state, vi.fn()];
  },
  useRef: (initial: unknown) => ({ current: initial }),
  useMemo: (compute: () => unknown) => compute(),
  useCallback: (callback: unknown) => callback,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => harness.router,
  useSearchParams: () => new URLSearchParams(harness.query),
}));
vi.mock("next/link", () => ({ default: () => null }));
vi.mock("@/lib/auth/use-app-session", () => ({
  useSession: () => ({ data: { user: { id: harness.sessionUserId, email: "" } }, status: harness.authStatus }),
}));
vi.mock("react-redux", () => ({
  useDispatch: () => vi.fn(),
  useSelector: (selector: (state: typeof harness.store) => unknown) => selector(harness.store),
}));
vi.mock("@/features/checkout/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/checkout/api")>()),
  fetchCheckoutPreview: harness.fetchPreview,
  fetchCheckoutProfile: harness.fetchProfile,
}));
vi.mock("@/lib/airwallex/components/AirwallexPayButton", () => ({ startAirwallexHostedCheckout: vi.fn(), AirwallexPayButton: () => null }));
vi.mock("@/lib/airwallex/components/AirwallexPaymentStatus", () => ({ AirwallexPaymentStatus: () => null }));
vi.mock("@/lib/feedback", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/ui/loading", () => ({ CheckoutPageSkeleton: () => null, FullPageLoader: () => null, OrderDetailsPageSkeleton: () => null, ButtonLoader: () => null }));
vi.mock("@/components/currency/FormattedCurrencyAmount", () => ({ default: () => null }));
vi.mock("@/components/ui/ColorBadge", () => ({ default: () => null }));
vi.mock("@/app/(shop)/checkout/components/CheckoutHeader", () => ({ default: () => null }));
vi.mock("@/app/(shop)/checkout/components/CheckoutItemsCard", () => ({ default: () => null }));
vi.mock("@/app/(shop)/checkout/components/CustomerForm", () => ({ default: () => null }));
vi.mock("@/app/(shop)/checkout/components/PaymentMethodPicker", () => ({ default: () => null }));
vi.mock("@/app/(shop)/checkout/components/OrderSummaryCard", () => ({ default: () => null }));
vi.mock("@/app/(shop)/orders/[id]/components/OrderTracker", () => ({ default: () => null }));
vi.mock("@/features/orders/api", () => ({ fetchOrderDetail: harness.fetchOrder }));
vi.mock("@/features/orders/pdf", () => ({ downloadOrderPdf: vi.fn() }));
vi.mock("@/features/orders/storage", () => ({ clearOrderSnapshot: vi.fn() }));

const preview: CheckoutPreview = {
  items: [{
    productId: "product-shirt",
    productCode: "CATALOG-SHIRT",
    variantId: "variant-red-large",
    sku: "RED-L",
    variantKey: "red-large",
    variantName: "Red / Large",
    modelNumber: null,
    color: "Red",
    size: "Large",
    attributes: null,
    attributeSummary: null,
    name: "Shirt",
    image: null,
    quantity: 3,
    unitPrice: 9,
    originalPrice: 10,
    lineTotal: 27,
    lineSavings: 3,
    baseUnitPrice: 900,
    baseOriginalPrice: 1000,
    baseLineTotal: 2700,
    baseLineSavings: 300,
    stock: 20,
  }],
  summary: {
    subtotal: 27,
    totalSavings: 3,
    totalSaved: 5,
    discount: 2,
    shipping: 1,
    tax: 2.5,
    total: 28.5,
    taxRate: 0.1,
    freeShippingThreshold: 100,
    shippingFee: 1,
    isOutsideDhaka: false,
    isFreeShippingApplied: false,
    currency: "USD",
    baseCurrency: "USD",
    baseSubtotal: 2700,
    baseTotalSavings: 300,
    baseTotalSaved: 500,
    baseDiscount: 200,
    baseShipping: 100,
    baseTax: 250,
    baseTotal: 2850,
    baseFreeShippingThreshold: 10000,
    baseShippingFee: 100,
    exchangeRate: "0.01",
    exchangeRateTimestamp: null,
  },
  promo: null,
  airwallexPaymentQuote: null,
  availablePaymentMethods: ["AIRWALLEX"],
};

function createBrowser() {
  const commands: unknown[][] = [];
  const handoff = (...args: unknown[]) => { commands.push(args); };
  const fbq = Object.assign((...args: unknown[]) => handoff(...args), { queue: commands, callMethod: handoff });
  const browser = { fbq };
  vi.stubGlobal("window", browser);
  vi.stubGlobal("document", { createElement: () => ({}), head: { appendChild: vi.fn() } });
  return browser;
}

function events(browser: ReturnType<typeof createBrowser>): unknown[][] {
  return (browser.fbq?.queue ?? []).filter((command) => ["track", "trackSingle"].includes(String(command[0])));
}

async function renderCheckoutEffects() {
  harness.effects = [];
  const { default: CheckoutPage } = await import("@/app/(shop)/checkout/page");
  const outer = CheckoutPage() as ReactElement<{ children: ReactElement }>;
  const inner = outer.props.children.type as () => ReactElement;
  inner();
  return harness.effects.map((effect) => effect());
}

async function flushPreview() {
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "1234567890");
  harness.query = "";
  harness.authStatus = "authenticated";
  harness.deliveryZone = "INSIDE_DHAKA";
  harness.readyOrder = null;
  harness.sessionUserId = "owner-1";
  harness.store.cart = { items: [], mode: "server", isHydrated: true, isLoading: false, error: null };
  harness.fetchPreview.mockReset().mockResolvedValue(preview);
  harness.fetchProfile.mockClear();
  harness.router.push.mockClear();
  harness.router.replace.mockClear();
});

describe("receipt Purchase requires verified data and matching browser checkout intent", () => {
  function verifiedOrder(): OrderDetail {
    return {
      id: "order-1", orderNumber: "ORDER-1", userId: "owner-1", guestCustomerId: null,
      customerName: "Test buyer", customerPhone: "", customerEmail: null, customerAddress: "",
      customerCity: null, customerPostalCode: null, customerNote: null,
      subtotal: 27, deliveryCharge: 1, discountAmount: 2, taxAmount: 2.5, totalAmount: 28.5, advancePayment: 0,
      currency: "USD", baseCurrency: "USD", paymentAmount: 28.5, paymentCurrency: "USD",
      baseSubtotal: 2700, baseDeliveryCharge: 100, baseDiscountAmount: 200, baseTaxAmount: 250, baseTotalAmount: 2850, baseAdvancePayment: 0,
      exchangeRate: "0.01", exchangeRateTimestamp: null, promoCode: null,
      status: "PAYMENT_CONFIRMED", paymentMethod: "AIRWALLEX", paymentStatus: "PAID", requiresPaymentReview: false,
      createdAt: "2026-10-04T00:00:00.000Z", updatedAt: "2026-10-04T00:00:00.000Z",
      items: [], statusHistory: [],
      metaPurchase: { eventId: "purchase:order-1", eventTime: 1791072000, items: preview.items, currency: "USD", value: 28.5 },
    };
  }

  async function renderReceiptEffects() {
    harness.effects = [];
    const { default: OrderSummaryClient } = await import("@/app/(shop)/orders/[id]/components/OrderSummaryClient");
    OrderSummaryClient({ orderId: "order-1" });
    harness.effects.forEach((effect) => effect());
    await flushPreview();
  }

  it("does not convert a historical paid receipt or query flags into a new Purchase", async () => {
    const browser = createBrowser();
    harness.readyOrder = verifiedOrder();
    harness.query = "just-placed=1&payment=success";
    await renderReceiptEffects();
    expect(events(browser)).toEqual([]);
  });

  it("emits one verified owner Purchase with checkout intent despite repeated receipt effects", async () => {
    const browser = createBrowser();
    harness.readyOrder = verifiedOrder();
    const pixel = await import("@/lib/analytics/meta-pixel");
    pixel.registerPurchaseIntent("order-1");
    await renderReceiptEffects();
    await renderReceiptEffects();
    expect(events(browser)).toEqual([
      ["trackSingle", "1234567890", "Purchase", expect.objectContaining({
        content_ids: ["CATALOG-SHIRT"], contents: [{ id: "CATALOG-SHIRT", quantity: 3, item_price: 9 }],
        currency: "USD", value: 28.5,
      }), { eventID: "purchase:order-1" }],
    ]);
  });

  it("does not convert an admin viewing another customer's order", async () => {
    const browser = createBrowser();
    harness.readyOrder = verifiedOrder();
    harness.sessionUserId = "admin-1";
    const pixel = await import("@/lib/analytics/meta-pixel");
    pixel.registerPurchaseIntent("order-1");
    await renderReceiptEffects();
    expect(events(browser)).toEqual([]);
  });

  it("loads guest confirmation using its scoped cookie without redirecting to login", async () => {
    createBrowser();
    harness.authStatus = "unauthenticated";
    harness.readyOrder = { ...verifiedOrder(), userId: null, guestCustomerId: "guest-1" };
    harness.fetchOrder.mockClear().mockResolvedValue(harness.readyOrder);
    await renderReceiptEffects();
    expect(harness.fetchOrder).toHaveBeenCalledWith("order-1");
    expect(harness.router.replace).not.toHaveBeenCalled();
  });

  it("emits the verified guest Purchase from a cookie-scoped receipt with checkout intent", async () => {
    const browser = createBrowser();
    harness.authStatus = "unauthenticated";
    harness.sessionUserId = undefined;
    harness.readyOrder = { ...verifiedOrder(), userId: null, guestCustomerId: "guest-1" };
    const pixel = await import("@/lib/analytics/meta-pixel");
    pixel.registerPurchaseIntent("order-1");
    await renderReceiptEffects();
    await renderReceiptEffects();
    expect(events(browser)).toEqual([
      ["trackSingle", "1234567890", "Purchase", expect.objectContaining({ value: 28.5, currency: "USD" }),
        { eventID: "purchase:order-1" }],
    ]);
    expect(harness.router.replace).not.toHaveBeenCalled();
  });

  it("emits nothing for an unverified receipt even when checkout intent is present", async () => {
    const browser = createBrowser();
    harness.readyOrder = { ...verifiedOrder(), metaPurchase: null, paymentStatus: "PENDING" };
    const pixel = await import("@/lib/analytics/meta-pixel");
    pixel.registerPurchaseIntent("order-1");
    await renderReceiptEffects();
    expect(events(browser)).toEqual([]);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("checkout destination is the canonical InitiateCheckout point", () => {
  it("does not price checkout or emit analytics until a delivery area is explicitly chosen", async () => {
    const browser = createBrowser();
    harness.query = "buy=product-shirt:3:variant-red-large";
    harness.deliveryZone = "";
    await renderCheckoutEffects();
    await flushPreview();

    expect(harness.fetchPreview).not.toHaveBeenCalled();
    expect(events(browser)).toEqual([]);

    harness.deliveryZone = "OUTSIDE_DHAKA";
    await renderCheckoutEffects();
    await flushPreview();

    expect(harness.fetchPreview).toHaveBeenCalledWith({
      items: [{ productId: "product-shirt", quantity: 3, variantId: "variant-red-large" }],
      deliveryZone: "OUTSIDE_DHAKA",
      promoCode: null,
    });
    expect(events(browser)).toEqual([
      ["track", "InitiateCheckout", expect.objectContaining({ value: 28.5, currency: "USD" }), { eventID: expect.any(String) }],
    ]);
  });

  it("starts Buy Now only after a valid authoritative checkout preview arrives", async () => {
    const browser = createBrowser();
    harness.query = "buy=product-shirt:3:variant-red-large";
    let resolvePreview!: (result: CheckoutPreview) => void;
    harness.fetchPreview.mockImplementation(() => new Promise((resolve) => { resolvePreview = resolve; }));
    await renderCheckoutEffects();
    expect(harness.fetchPreview).toHaveBeenCalledWith({
      items: [{ productId: "product-shirt", quantity: 3, variantId: "variant-red-large" }],
      deliveryZone: "INSIDE_DHAKA",
      promoCode: null,
    });
    expect(events(browser)).toEqual([]);
    resolvePreview(preview);
    await flushPreview();
    expect(events(browser)).toEqual([
      ["track", "InitiateCheckout", expect.objectContaining({
        content_ids: ["CATALOG-SHIRT"],
        variant_ids: ["variant-red-large"],
        contents: [{ id: "CATALOG-SHIRT", quantity: 3, item_price: 9 }],
        currency: "USD",
        num_items: 3,
        value: 28.5,
      }), { eventID: expect.stringMatching(/^checkout:/) }],
    ]);
  });

  it("starts normal persisted-cart checkout from the same accepted-preview point", async () => {
    const browser = createBrowser();
    await renderCheckoutEffects();
    await flushPreview();
    expect(harness.fetchPreview).toHaveBeenCalledWith({ items: undefined, deliveryZone: "INSIDE_DHAKA", promoCode: null });
    expect(events(browser)).toEqual([
      ["track", "InitiateCheckout", expect.objectContaining({ value: 28.5, currency: "USD", num_items: 3 }), { eventID: expect.any(String) }],
    ]);
  });

  it("covers selected-cart checkout without duplicating the Buy Now path", async () => {
    const browser = createBrowser();
    harness.query = "source=cart&buy=product-shirt:3:variant-red-large";
    await renderCheckoutEffects();
    await flushPreview();
    await renderCheckoutEffects();
    await flushPreview();
    expect(harness.fetchPreview).toHaveBeenCalledTimes(2);
    expect(events(browser)).toHaveLength(1);
    expect(events(browser)[0][1]).toBe("InitiateCheckout");
  });

  it("emits nothing when checkout preparation fails", async () => {
    const browser = createBrowser();
    harness.query = "buy=product-shirt:3:variant-red-large";
    harness.fetchPreview.mockRejectedValue(new Error("No stock available"));
    await renderCheckoutEffects();
    await flushPreview();
    expect(events(browser)).toEqual([]);
  });

  it("emits nothing for a preview discarded after navigation or effect cleanup", async () => {
    const browser = createBrowser();
    let resolvePreview!: (result: CheckoutPreview) => void;
    harness.fetchPreview.mockImplementation(() => new Promise((resolve) => { resolvePreview = resolve; }));
    const cleanups = await renderCheckoutEffects();
    cleanups.forEach((cleanup) => cleanup?.());
    resolvePreview(preview);
    await flushPreview();
    expect(events(browser)).toEqual([]);
  });

  it("starts guest cart checkout with explicit local items and optional login", async () => {
    createBrowser();
    harness.authStatus = "unauthenticated";
    harness.store.cart.mode = "local";
    harness.store.cart.items = [{
      id: "local:variant-red-large", productId: "product-shirt", variantId: "variant-red-large",
      name: "Shirt", image: null, quantity: 3, unitPrice: 900, originalPrice: 1000,
      lineTotal: 2700, stock: 20, status: "ACTIVE",
    }];
    await renderCheckoutEffects();
    await flushPreview();
    expect(harness.router.replace).not.toHaveBeenCalled();
    expect(harness.fetchProfile).not.toHaveBeenCalled();
    expect(harness.fetchPreview).toHaveBeenCalledWith({
      items: [{ productId: "product-shirt", variantId: "variant-red-large", quantity: 3 }],
      deliveryZone: "INSIDE_DHAKA", promoCode: null,
    });
  });

  it("waits for session resolution and hydrated cart data", async () => {
    const browser = createBrowser();
    harness.authStatus = "loading";
    await renderCheckoutEffects();
    await flushPreview();
    expect(harness.fetchPreview).not.toHaveBeenCalled();
    harness.authStatus = "authenticated";
    harness.store.cart.isHydrated = false;
    await renderCheckoutEffects();
    await flushPreview();
    expect(harness.fetchPreview).not.toHaveBeenCalled();
    expect(events(browser)).toEqual([]);
  });
});

vi.mock("next-intl", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next-intl")>()),
  useLocale: () => "en",
  useTranslations: () => createIntlTranslator({ locale: "en", messages: { ...coreMessages, ...interfaceMessages, ...adminMessages } }),
}));
vi.mock("@/components/i18n/useLocaleDraft", () => ({ useLocaleDraft: () => undefined, useLocaleSwitchGuard: () => undefined }));
vi.mock("@/lib/i18n/navigation", async () => ({ ...(await import("next/navigation")), default: (await import("next/link")).default }));
