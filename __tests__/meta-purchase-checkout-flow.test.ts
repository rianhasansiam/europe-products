import { CART_LOCAL_STORAGE_KEY } from "@/features/cart/storage";
import { createTranslator as createIntlTranslator } from "next-intl";
import coreMessages from "@/messages/core-en.json";
import interfaceMessages from "@/messages/interface-en.json";
import adminMessages from "@/messages/admin-en.json";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { Decimal } from "@prisma/client/runtime/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CustomerFormState } from "@/app/(shop)/checkout/components/CustomerForm";
import type { CartItem } from "@/features/cart/api";
import type { CheckoutPreview } from "@/features/checkout/api";
import type { OrderDetail } from "@/features/orders/api";
import { buildVerifiedPurchaseSnapshot } from "@/lib/analytics/order-purchase";
import type { PixelFunction } from "@/lib/analytics/meta-pixel";
import type { AirwallexPublicPaymentStatus } from "@/lib/airwallex/components/AirwallexPaymentStatus";

// Use the existing Vitest node scheduler harness. Checkout/receipt handlers,
// fetch adapters, saved-payment builder and Pixel adapter are real; presentation,
// gateway navigation, API transport and SDK delivery are mocked. These checks
// establish application flow, never a browser network request or Meta receipt.
const harness = vi.hoisted(() => ({
  surface: "checkout" as "checkout" | "receipt" | "payment",
  states: { checkout: [] as unknown[], receipt: [] as unknown[], payment: [] as unknown[] },
  refs: { checkout: [] as { current: unknown }[], receipt: [] as { current: unknown }[], payment: [] as { current: unknown }[] },
  stateCursor: 0,
  refCursor: 0,
  effects: [] as Array<() => void | (() => void)>,
  mountedCleanups: [] as Array<() => void>,
  authStatus: "unauthenticated",
  ownerId: undefined as string | undefined,
  query: "",
  cart: { items: [] as CartItem[], mode: "local", isHydrated: true, isLoading: false, error: null },
  fetchPreview: vi.fn(),
  fetchProfile: vi.fn(),
  fetchCart: vi.fn(),
  hostedCheckout: vi.fn(),
  settled: vi.fn(),
  dispatch: vi.fn(),
  router: { push: vi.fn(), replace: vi.fn() },
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useState: (initial: unknown) => {
    const states = harness.states[harness.surface];
    const index = harness.stateCursor++;
    if (index >= states.length) states.push(typeof initial === "function" ? initial() : initial);
    return [states[index], (next: unknown) => {
      states[index] = typeof next === "function" ? next(states[index]) : next;
    }];
  },
  useRef: (initial: unknown) => {
    const refs = harness.refs[harness.surface];
    const index = harness.refCursor++;
    if (index >= refs.length) refs.push({ current: initial });
    return refs[index];
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
  useSession: () => ({ data: { user: { id: harness.ownerId, email: "account@example.test" } }, status: harness.authStatus }),
}));
vi.mock("react-redux", () => ({
  useDispatch: () => harness.dispatch,
  useSelector: (selector: (state: { cart: typeof harness.cart }) => unknown) => selector({ cart: harness.cart }),
}));
vi.mock("@/features/checkout/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/checkout/api")>()),
  fetchCheckoutPreview: harness.fetchPreview,
  fetchCheckoutProfile: harness.fetchProfile,
}));
vi.mock("@/features/cart/api", () => ({ fetchServerCartSnapshot: harness.fetchCart }));
vi.mock("@/lib/airwallex/components/AirwallexPayButton", () => ({ startAirwallexHostedCheckout: harness.hostedCheckout, AirwallexPayButton: () => null }));
vi.mock("@/lib/airwallex/components/AirwallexPaymentStatus", () => ({ AirwallexPaymentStatus: () => null }));
vi.mock("@/lib/feedback", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }));
vi.mock("@/components/ui/loading", () => ({ CheckoutPageSkeleton: () => null, FullPageLoader: () => null, OrderDetailsPageSkeleton: () => null, ButtonLoader: () => null }));
vi.mock("@/components/currency/FormattedCurrencyAmount", () => ({ default: () => null }));
vi.mock("@/components/ui/ColorBadge", () => ({ default: () => null }));
vi.mock("@/app/(shop)/checkout/components/CheckoutHeader", () => ({ default: () => null }));
vi.mock("@/app/(shop)/checkout/components/CheckoutItemsCard", () => ({ default: () => null }));
vi.mock("@/app/(shop)/checkout/components/CustomerForm", () => ({ default: () => null }));
vi.mock("@/app/(shop)/checkout/components/PaymentMethodPicker", () => ({ default: () => null }));
vi.mock("@/app/(shop)/checkout/components/OrderSummaryCard", () => ({ default: () => null }));
vi.mock("@/app/(shop)/orders/[id]/components/OrderTracker", () => ({ default: () => null }));
vi.mock("@/features/orders/pdf", () => ({ downloadOrderPdf: vi.fn() }));
vi.mock("@/features/orders/storage", () => ({ clearOrderSnapshot: vi.fn() }));

type Gateway = "AIRWALLEX";
type Customer = "guest" | "registered";
type PurchaseOrder = Parameters<typeof buildVerifiedPurchaseSnapshot>[0];
const cases = [
  { customer: "guest", gateway: "AIRWALLEX", currency: "USD", value: 2010 },
  { customer: "registered", gateway: "AIRWALLEX", currency: "USD", value: 2010 },
] as const;
const orderId = "flow-order-1";
const cartItem: CartItem = {
  id: "local:variant-1", productId: "product-1", productCode: "CATALOG-1", variantId: "variant-1",
  name: "Product", image: null, quantity: 2, unitPrice: 900, originalPrice: 1000,
  lineTotal: 1800, stock: 10, status: "ACTIVE",
};
const preview: CheckoutPreview = {
  items: [{
    productId: "product-1", productCode: "CATALOG-1", variantId: "variant-1", sku: "BLUE-S",
    variantKey: "blue-small", variantName: "Blue / Small", modelNumber: null, color: "Blue", size: "Small",
    attributes: null, attributeSummary: null, name: "Product", image: null, quantity: 2,
    unitPrice: 900, originalPrice: 1000, lineTotal: 1800, lineSavings: 200,
    baseUnitPrice: 900, baseOriginalPrice: 1000, baseLineTotal: 1800, baseLineSavings: 200, stock: 10,
  }],
  // New checkout uses the same reviewed USD amounts throughout.
  summary: {
    subtotal: 1800, totalSavings: 200, totalSaved: 300, discount: 100, shipping: 60, tax: 250,
    total: 2010, taxRate: 0.1, freeShippingThreshold: 10000, shippingFee: 60,
    isOutsideDhaka: false, isFreeShippingApplied: false, currency: "USD", baseCurrency: "USD",
    baseSubtotal: 1800, baseTotalSavings: 200, baseTotalSaved: 300, baseDiscount: 100,
    baseShipping: 60, baseTax: 250, baseTotal: 2010, baseFreeShippingThreshold: 10000,
    baseShippingFee: 60, exchangeRate: "1", exchangeRateTimestamp: "2026-10-04T06:00:00.000Z",
  },
  promo: null,
  airwallexPaymentQuote: {
    baseCurrency: "USD", baseAmount: 2010, displayCurrency: "USD", paymentCurrency: "USD",
    paymentAmount: 2010, exchangeRate: "1", exchangeRateTimestamp: "2026-10-04T06:00:00.000Z",
    quoteToken: "mock-signed-quote",
  },
  availablePaymentMethods: ["AIRWALLEX"],
};

function savedOrder(customer: Customer, gateway: Gateway): PurchaseOrder {
  return {
    id: orderId, userId: customer === "guest" ? null : "owner-1", status: "PAYMENT_CONFIRMED",
    paymentMethod: gateway, paymentStatus: "PAID", totalAmount: new Decimal("2010.00"), currency: "USD", baseCurrency: "USD",
    items: [{ productId: "product-1", product: { productCode: "CATALOG-1" }, variantId: "variant-1", productName: "Product", sku: "BLUE-S", quantity: 2, unitPrice: new Decimal("900.00") }],
    payments: [{
      provider: gateway, status: "SUCCESS", requiresReview: false, transactionId: "mock-private-provider-id",
      validationId: null,
      providerStatus: gateway === "AIRWALLEX" ? "SUCCEEDED" : null, paidAt: new Date("2026-10-04T06:00:00.000Z"),
      amount: new Decimal("2010.00"),
      currency: gateway === "AIRWALLEX" ? "USD" : "USD", baseAmount: gateway === "AIRWALLEX" ? new Decimal("2010.00") : null,
      baseCurrency: gateway === "AIRWALLEX" ? "USD" : null, exchangeRate: gateway === "AIRWALLEX" ? new Decimal("1") : null,
    }],
  };
}

function receipt(order: PurchaseOrder): OrderDetail {
  return {
    id: order.id, orderNumber: "FLOW-ORDER-1", userId: order.userId, guestCustomerId: order.userId ? null : "guest-1",
    customerName: "Test buyer", customerPhone: "", customerEmail: null, customerAddress: "",
    customerCity: null, customerPostalCode: null, customerNote: null,
    subtotal: 1800, deliveryCharge: 60, discountAmount: 100, taxAmount: 250, totalAmount: 2010, advancePayment: 0,
    currency: "USD", baseCurrency: "USD", paymentAmount: Number(order.payments[0].amount),
    paymentCurrency: order.payments[0].currency as OrderDetail["paymentCurrency"],
    baseSubtotal: 1800, baseDeliveryCharge: 60, baseDiscountAmount: 100, baseTaxAmount: 250, baseTotalAmount: 2010, baseAdvancePayment: 0,
    exchangeRate: "1", exchangeRateTimestamp: "2026-10-04T06:00:00.000Z", promoCode: null,
    status: order.status as OrderDetail["status"], paymentMethod: order.paymentMethod as Gateway,
    paymentStatus: order.paymentStatus as OrderDetail["paymentStatus"], requiresPaymentReview: order.payments.some((payment) => payment.requiresReview),
    createdAt: "2026-10-04T06:00:00.000Z", updatedAt: "2026-10-04T06:00:00.000Z", items: [], statusHistory: [],
    metaPurchase: buildVerifiedPurchaseSnapshot(order),
  };
}

function fakeBrowser(storage = new Map<string, string>()) {
  const scripts: Array<{ onload?: () => void; onerror?: () => void }> = [];
  const handoff = vi.fn();
  const browser = {
    crypto: { randomUUID: () => "8d2414af-e2cb-4a19-a6d8-16d0168ee775" },
    fbq: undefined as PixelFunction | undefined,
    location: { assign: vi.fn() },
    setTimeout: vi.fn<(callback: () => void, delay?: number) => number>(() => 1), clearTimeout: vi.fn(),
    localStorage: {
      get length() { return storage.size; }, key: (index: number) => [...storage.keys()][index] ?? null,
      getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value); },
      removeItem: (key: string) => { storage.delete(key); },
    },
  };
  vi.stubGlobal("window", Object.assign(browser, { __sexToyUsdPricingReady: true }));
  vi.stubGlobal("document", { createElement: () => ({ remove: vi.fn() }), head: { appendChild: (script: typeof scripts[number]) => { scripts.push(script); } } });
  const loadSdk = () => {
    browser.fbq!.callMethod = handoff;
    scripts.at(-1)?.onload?.();
  };
  const purchases = () => handoff.mock.calls.filter((command) => command[0] === "trackSingle" && command[2] === "Purchase");
  return { browser, storage, scripts, handoff, loadSdk, purchases };
}

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

async function render(surface: typeof harness.surface, runEffects = false, keepMounted = false) {
  harness.surface = surface;
  harness.stateCursor = 0;
  harness.refCursor = 0;
  harness.effects = [];
  let tree: ReactElement;
  if (surface === "checkout") {
    const { default: CheckoutPage } = await import("@/app/(shop)/checkout/page");
    const outer = CheckoutPage() as ReactElement<{ children: ReactElement }>;
    tree = (outer.props.children.type as () => ReactElement)();
  } else if (surface === "receipt") {
    const { default: OrderSummaryClient } = await import("@/app/(shop)/orders/[id]/components/OrderSummaryClient");
    tree = OrderSummaryClient({ orderId });
  } else {
    const { AirwallexPaymentStatus } = await vi.importActual<typeof import("@/lib/airwallex/components/AirwallexPaymentStatus")>("@/lib/airwallex/components/AirwallexPaymentStatus");
    tree = AirwallexPaymentStatus({ orderId, autoPoll: false, onSettled: harness.settled });
  }
  if (runEffects) {
    const cleanups = harness.effects.map((effect) => effect());
    // Response.json() completes after the fetch promise; let the real API
    // adapter settle before simulating effect cleanup or the next render.
    await new Promise<void>((resolve) => setImmediate(resolve));
    cleanups.forEach((cleanup) => {
      if (!cleanup) return;
      if (keepMounted) harness.mountedCleanups.push(cleanup);
      else cleanup();
    });
  }
  return tree;
}

async function submitCheckout(customer: Customer) {
  harness.authStatus = customer === "guest" ? "unauthenticated" : "authenticated";
  harness.ownerId = customer === "guest" ? undefined : "owner-1";
  harness.cart.mode = customer === "guest" ? "local" : "server";
  const formProps = findProps(await render("checkout"), "form");
  const onChange = formProps.onChange as (field: keyof CustomerFormState, value: string) => void;
  onChange("customerName", "Test buyer");
  onChange("customerPhone", "01700000000");
  onChange("customerEmail", "guest@example.test");
  onChange("customerAddress", "12 Main Road");
  onChange("deliveryZone", "INSIDE_DHAKA");
  await render("checkout", true);
  const submit = findProps(await render("checkout"), "onPlaceOrder").onPlaceOrder as () => Promise<void>;
  await submit();
  return findProps(await render("checkout"), "onPlaceOrder");
}

function mockApi(order: PurchaseOrder, airwallexStatus: AirwallexPublicPaymentStatus = "SUCCEEDED") {
  const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async (url) => {
    if (url === "/api/checkout") return new Response(JSON.stringify({ success: true, data: {
      order: { id: orderId, orderNumber: "FLOW-ORDER-1" }, summary: preview.summary, promo: null,
    } }));
    if (url === `/api/orders/${orderId}`) return new Response(JSON.stringify({ success: true, data: receipt(order) }));
    if (url === `/api/payments/airwallex/status/${orderId}`) return new Response(JSON.stringify({ success: true, data: {
      orderId, provider: "AIRWALLEX", paymentStatus: airwallexStatus,
      requiresReview: order.payments.some((payment) => payment.requiresReview), failureMessage: null,
      updatedAt: "2026-10-04T06:00:00.000Z", terminal: ["SUCCEEDED", "FAILED", "CANCELLED"].includes(airwallexStatus),
    } }));
    throw new Error(`Unexpected mock request: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function showReceipt() {
  await render("receipt", true);
  await render("receipt", true);
  expect(harness.states.receipt[0]).toMatchObject({ status: "ready", order: { id: orderId } });
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "1234567890");
  harness.states = { checkout: [], receipt: [], payment: [] };
  harness.refs = { checkout: [], receipt: [], payment: [] };
  harness.mountedCleanups = [];
  harness.query = "";
  harness.cart = { items: [cartItem], mode: "local", isHydrated: true, isLoading: false, error: null };
  harness.fetchPreview.mockReset().mockResolvedValue(preview);
  harness.fetchProfile.mockReset().mockResolvedValue(null);
  harness.fetchCart.mockReset().mockResolvedValue({ items: [], summary: { totalItems: 0, subtotal: 0, totalDiscount: 0, finalTotal: 0 } });
  harness.hostedCheckout.mockReset().mockResolvedValue(undefined);
  harness.settled.mockClear();
  harness.dispatch.mockClear();
  harness.router.push.mockClear();
  harness.router.replace.mockClear();
});

afterEach(() => {
  harness.mountedCleanups.forEach((cleanup) => cleanup());
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("committed online checkout through verified receipt and mocked SDK delivery", () => {
  it.each(cases)("preserves $customer $gateway saved $currency/$value through cart clearing, gateway return and refresh", async ({ customer, gateway, currency, value }) => {
    const initial = fakeBrowser();
    const order = savedOrder(customer, gateway);
    const fetchMock = mockApi(order);
    await submitCheckout(customer);
    const submitted = JSON.parse(String(fetchMock.mock.calls.find(([url]) => url === "/api/checkout")?.[1]?.body));
    expect(submitted).toMatchObject({ paymentMethod: gateway, clearCart: true });
    expect(submitted).not.toHaveProperty("totalAmount");
    expect(initial.storage.get(CART_LOCAL_STORAGE_KEY)).toBe("[]");
    const pixel = await import("@/lib/analytics/meta-pixel");
    expect(pixel.hasPurchaseIntent(orderId)).toBe(true);
    expect(initial.purchases()).toEqual([]);
    expect(harness.hostedCheckout).toHaveBeenCalledExactlyOnceWith(orderId);
    expect(harness.fetchCart).toHaveBeenCalledTimes(customer === "registered" ? 1 : 0);

    const returned = fakeBrowser(initial.storage);
    harness.query = "just-placed=1&payment=success";
    await showReceipt();
    await showReceipt();
    expect(returned.purchases()).toEqual([]);
    expect(receipt(order).metaPurchase).toMatchObject({ eventId: `purchase:${orderId}`, eventTime: 1791093600, currency, value });
    returned.loadSdk();
    expect(returned.purchases()).toEqual([["trackSingle", "1234567890", "Purchase", expect.objectContaining({
      currency, value, content_ids: ["CATALOG-1"],
      contents: [{ id: "CATALOG-1", quantity: 2, item_price: 900 }],
    }), { eventID: `purchase:${orderId}` }]]);

    const refreshed = fakeBrowser(initial.storage);
    harness.states.receipt = [];
    harness.refs.receipt = [];
    await showReceipt();
    refreshed.loadSdk();
    expect(refreshed.purchases()).toEqual([]);
  });

  it.each(cases.flatMap((flow) => ["pending", "failed", "cancelled", "review-held"].map((outcome) => ({ ...flow, outcome }))))(
    "suppresses $customer $gateway $outcome despite a committed intent and success URL", async ({ customer, gateway, outcome }) => {
      const current = fakeBrowser();
      const order = savedOrder(customer, gateway);
      if (outcome === "review-held") order.payments[0].requiresReview = true;
      else {
        order.status = outcome === "cancelled" ? "CANCELLED" : "PENDING";
        order.paymentStatus = outcome === "failed" ? "FAILED" : "PENDING";
        order.payments[0].status = outcome === "pending" ? "PENDING" : outcome === "failed" ? "FAILED" : "CANCELLED";
      }
      mockApi(order);
      await submitCheckout(customer);
      harness.query = "just-placed=1&payment=success";
      expect(receipt(order).metaPurchase).toBeNull();
      await showReceipt();
      current.loadSdk();
      expect(current.purchases()).toEqual([]);
    },
  );

  it.each(cases)("keeps $customer $gateway successful checkout and receipt available when SDK insertion fails", async ({ customer, gateway }) => {
    const current = fakeBrowser();
    const order = savedOrder(customer, gateway);
    mockApi(order);
    vi.stubGlobal("document", { createElement: () => ({}), head: { appendChild: () => { throw new Error("Blocked analytics script"); } } });
    const summary = await submitCheckout(customer);
    expect(summary.submitError).toBeNull();
    expect(harness.hostedCheckout).toHaveBeenCalledOnce();
    await showReceipt();
    expect(harness.states.receipt[0]).toMatchObject({ status: "ready", order: { id: orderId, paymentStatus: "PAID" } });
    expect(current.purchases()).toEqual([]);
  });

  it.each(cases)("denied or revoked consent prevents $customer $gateway delivery and later replay", async ({ customer, gateway }) => {
    const current = fakeBrowser();
    const order = savedOrder(customer, gateway);
    mockApi(order);
    const pixel = await import("@/lib/analytics/meta-pixel");
    await submitCheckout(customer);
    await showReceipt();
    pixel.setMetaPixelConsent(false);
    current.loadSdk();
    pixel.setMetaPixelConsent(true);
    await showReceipt();
    expect(pixel.hasPurchaseIntent(orderId)).toBe(false);
    expect(current.purchases()).toEqual([]);
  });

  it.each(cases)("consent denied at $customer $gateway checkout preserves success without later attribution", async ({ customer, gateway }) => {
    const current = fakeBrowser();
    mockApi(savedOrder(customer, gateway));
    const pixel = await import("@/lib/analytics/meta-pixel");
    pixel.setMetaPixelConsent(false);
    const summary = await submitCheckout(customer);
    expect(summary.submitError).toBeNull();
    expect(current.storage.get(CART_LOCAL_STORAGE_KEY)).toBe("[]");
    expect(pixel.hasPurchaseIntent(orderId)).toBe(false);
    await showReceipt();
    pixel.setMetaPixelConsent(true);
    pixel.initializeMetaPixel();
    current.loadSdk();
    await showReceipt();
    expect(current.purchases()).toEqual([]);
  });

  it.each(cases)("retries delayed $customer $gateway SDK failures with the original saved payload and identity", async ({ customer, gateway, currency, value }) => {
    const current = fakeBrowser();
    const order = savedOrder(customer, gateway);
    mockApi(order);
    await submitCheckout(customer);
    await showReceipt();
    current.handoff.mockImplementationOnce(() => { throw new Error("Temporary mocked SDK failure"); });
    current.loadSdk();
    const firstAttempt = current.purchases()[0];
    expect(firstAttempt).toEqual(["trackSingle", "1234567890", "Purchase", expect.objectContaining({ currency, value }), { eventID: `purchase:${orderId}` }]);
    expect(current.storage.has(`enterfly:meta-purchase:1234567890:purchase:${orderId}`)).toBe(false);

    // A new receipt response or a changed/cleared cart cannot rewrite the
    // canonical data captured by the first pending attempt for this event ID.
    order.totalAmount = new Decimal("1000");
    order.payments[0].baseAmount = gateway === "AIRWALLEX" ? new Decimal("1000") : null;
    order.payments[0].amount = new Decimal(gateway === "AIRWALLEX" ? "8.20" : "1000");
    order.items = [];
    await showReceipt();
    expect(current.purchases()).toEqual([firstAttempt, firstAttempt]);
    expect(current.storage.get(`enterfly:meta-purchase:1234567890:purchase:${orderId}`)).toBe("sdk_handoff");
    await showReceipt();
    expect(current.purchases()).toHaveLength(2);
  });

  it.each(cases)("requires a retained checkout intent for $customer $gateway receipt delivery", async ({ customer, gateway }) => {
    const current = fakeBrowser();
    const order = savedOrder(customer, gateway);
    mockApi(order);
    await submitCheckout(customer);
    current.storage.delete(`enterfly:meta-checkout:1234567890:${orderId}`);
    const returned = fakeBrowser(current.storage);
    harness.query = "just-placed=1&payment=success";
    await showReceipt();
    // Initializing the SDK cannot create attribution for a missing/cleared marker.
    const pixel = await import("@/lib/analytics/meta-pixel");
    pixel.initializeMetaPixel();
    returned.loadSdk();
    expect(pixel.hasPurchaseIntent(orderId)).toBe(false);
    expect(returned.purchases()).toEqual([]);
  });

  it.each(["guest", "registered"] as const)("uses the owner/cookie-authorized order snapshot after %s Airwallex status succeeds", async (customer) => {
    const current = fakeBrowser();
    const fetchMock = mockApi(savedOrder(customer, "AIRWALLEX"));
    await submitCheckout(customer);
    await render("payment", true);
    expect(fetchMock).toHaveBeenCalledWith(`/api/payments/airwallex/status/${orderId}`, expect.objectContaining({ method: "GET", cache: "no-store" }));
    expect(fetchMock).toHaveBeenCalledWith(`/api/orders/${orderId}`, { method: "GET", cache: "no-store" });
    expect(harness.states.payment[0]).toMatchObject({ status: "ready", snapshot: { paymentStatus: "SUCCEEDED" } });
    expect(harness.settled).toHaveBeenCalledOnce();
    current.loadSdk();
    await showReceipt();
    expect(current.purchases()).toEqual([["trackSingle", "1234567890", "Purchase", expect.objectContaining({ currency: "USD", value: 2010 }), { eventID: `purchase:${orderId}` }]]);
  });

  it.each((["guest", "registered"] as const).flatMap((customer) => ["PENDING", "PROCESSING", "FAILED", "CANCELLED", "PENDING_REVIEW", "REQUIRES_REVIEW"].map((status) => ({ customer, status: status as AirwallexPublicPaymentStatus }))))(
    "does not treat $customer Airwallex status $status as verified order evidence", async ({ customer, status }) => {
      const current = fakeBrowser();
      const fetchMock = mockApi(savedOrder(customer, "AIRWALLEX"), status);
      await submitCheckout(customer);
      await render("payment", true);
      current.loadSdk();
      expect(fetchMock.mock.calls.filter(([url]) => url === `/api/orders/${orderId}`)).toEqual([]);
      expect(current.purchases()).toEqual([]);
    },
  );

  it.each(["guest", "registered"] as const)("rejects %s Airwallex SUCCEEDED while review-held or lacking verified order evidence", async (customer) => {
    const current = fakeBrowser();
    const order = savedOrder(customer, "AIRWALLEX");
    order.paymentStatus = "PENDING";
    const fetchMock = mockApi(order);
    await submitCheckout(customer);
    await render("payment", true);
    current.loadSdk();
    expect(fetchMock.mock.calls.filter(([url]) => url === `/api/orders/${orderId}`)).toHaveLength(1);
    expect(current.purchases()).toEqual([]);
    order.paymentStatus = "PAID";
    order.payments[0].requiresReview = true;
    fetchMock.mockClear();
    await render("payment", true);
    expect(fetchMock.mock.calls.filter(([url]) => url === `/api/orders/${orderId}`)).toEqual([]);
    expect(current.purchases()).toEqual([]);
  });


});

vi.mock("next-intl", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next-intl")>()),
  useLocale: () => "en",
  useTranslations: () => createIntlTranslator({ locale: "en", messages: { ...coreMessages, ...interfaceMessages, ...adminMessages } }),
}));
vi.mock("@/components/i18n/useLocaleDraft", () => ({ useLocaleDraft: () => undefined, useLocaleSwitchGuard: () => undefined }));
vi.mock("@/lib/i18n/navigation", async () => ({ ...(await import("next/navigation")), default: (await import("next/link")).default }));
