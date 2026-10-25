import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CartItem } from "@/features/cart/api";
import type { PlaceOrderRequest } from "@/features/checkout/api";
import type { CommerceItem } from "@/lib/analytics/ecommerce";

type PixelCommand = unknown[];
type TestPixel = ((...args: unknown[]) => void) & {
  queue?: ArrayLike<unknown>[];
  callMethod?: (...args: unknown[]) => void;
};

function fakeBrowser(storage = new Map<string, string>()) {
  const scripts: Array<Record<string, unknown>> = [];
  const appendChild = vi.fn((script: Record<string, unknown>) => {
    scripts.push(script);
    return script;
  });
  const firstScript = { parentNode: { insertBefore: appendChild } };
  const document = {
    head: { appendChild },
    body: { appendChild },
    createElement: vi.fn(() => ({ setAttribute: vi.fn() })),
    getElementById: vi.fn((id: string) => scripts.find((script) => script.id === id)),
    querySelector: vi.fn(() => scripts[0] ?? null),
    getElementsByTagName: vi.fn(() => [firstScript]),
  };
  const browser: {
    fbq?: TestPixel;
    _fbq?: TestPixel;
    document: typeof document;
    location: { href: string; pathname: string; search: string };
    localStorage: {
      readonly length: number;
      key: (index: number) => string | null;
      getItem: (key: string) => string | null;
      setItem: (key: string, value: string) => void;
      removeItem: (key: string) => void;
    };
  } = {
    document,
    location: { href: "https://sextoybd.net/products/shirt", pathname: "/products/shirt", search: "" },
    localStorage: {
      get length() { return storage.size; },
      key: (index) => [...storage.keys()][index] ?? null,
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => { storage.set(key, value); },
      removeItem: (key) => { storage.delete(key); },
    },
  };
  vi.stubGlobal("window", Object.assign(browser, { __sexToyUsdPricingReady: true }));
  vi.stubGlobal("document", document);
  return { browser, scripts, storage };
}

function queuedCommands(browser: ReturnType<typeof fakeBrowser>["browser"]): PixelCommand[] {
  return (browser.fbq?.queue ?? []).map((command) => Array.from(command));
}

/** Simulate SDK readiness without loading or sending anything to Meta. */
function loadSdk(browser: ReturnType<typeof fakeBrowser>["browser"], scripts: ReturnType<typeof fakeBrowser>["scripts"]) {
  const handoff = vi.fn();
  if (!browser.fbq) throw new Error("Initialize the Pixel before simulating its SDK");
  browser.fbq.callMethod = handoff;
  const latestScript = scripts.at(-1);
  (latestScript?.onload as (() => void) | undefined)?.();
  return handoff;
}

function purchaseSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    eventId: "purchase:order-confirmed-1", eventTime: 1791072000,
    items: [{ ...commerceItem }], currency: "USD" as const, value: 980,
    ...overrides,
  };
}

const commerceItem: CommerceItem = {
  productId: "product-shirt",
  productCode: "CATALOG-SHIRT",
  variantId: "variant-red-large",
  name: "Shirt",
  quantity: 2,
  unitPrice: 450,
};

function serverLine(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: "cart-row",
    productId: "product-shirt",
    productCode: "CATALOG-SHIRT",
    variantId: "variant-red-large",
    name: "Shirt",
    image: null,
    quantity: 8,
    unitPrice: 450,
    originalPrice: 500,
    lineTotal: 3600,
    stock: 20,
    status: "ACTIVE",
    ...overrides,
  };
}

function envelopeResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ success: status < 400, data, message: "Cart rejected" }), {
    status,
    headers: { "Content-Type": "application/json", "X-Store-Pricing-Ready": "true" },
  });
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "1234567890");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Meta Pixel delivery", () => {
  it("initializes once and queues eligible actions while the external script is delayed", async () => {
    const { browser, scripts } = fakeBrowser();
    const pixel = await import("@/lib/analytics/meta-pixel");

    expect(pixel.initializeMetaPixel()).toBe(true);
    expect(pixel.initializeMetaPixel()).toBe(true);
    pixel.trackPageView("/products/shirt");
    pixel.trackAddToCart(commerceItem, "cart-operation-1");

    const commands = queuedCommands(browser);
    expect(commands.filter((command) => command[0] === "init")).toEqual([
      ["init", "1234567890"],
    ]);
    expect(commands.filter((command) => command[0] === "track")).toEqual([
      ["track", "PageView", expect.any(Object), { eventID: expect.any(String) }],
      ["track", "AddToCart", expect.objectContaining({
        content_ids: ["CATALOG-SHIRT"],
        contents: [{ id: "CATALOG-SHIRT", quantity: 2, item_price: 450 }],
        value: 900,
        currency: "USD",
      }), { eventID: "cart-operation-1" }],
    ]);
    expect(scripts).toHaveLength(1);
    expect(scripts[0].src).toBe("https://connect.facebook.net/en_US/fbevents.js");
  });

  it("disables delivery without configuration and is safe during server execution", async () => {
    const { browser, scripts } = fakeBrowser();
    vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "");
    const pixel = await import("@/lib/analytics/meta-pixel");
    expect(pixel.initializeMetaPixel()).toBe(false);
    pixel.trackAddToCart(commerceItem, "missing-config");
    expect(queuedCommands(browser)).toEqual([]);
    expect(scripts).toEqual([]);

    vi.stubGlobal("window", undefined);
    vi.stubGlobal("document", undefined);
    expect(() => pixel.trackViewContent(commerceItem, "server-view")).not.toThrow();
    expect(pixel.initializeMetaPixel()).toBe(false);
  });

  it("deduplicates callbacks for one action while retaining independent additions", async () => {
    const { browser } = fakeBrowser();
    const pixel = await import("@/lib/analytics/meta-pixel");
    pixel.trackAddToCart(commerceItem, "same-operation");
    pixel.trackAddToCart(commerceItem, "same-operation");
    pixel.trackAddToCart(commerceItem, "next-operation");
    pixel.trackViewContent(commerceItem, "same-operation");

    expect(queuedCommands(browser).filter((command) => command[0] === "track").map((command) => [command[1], command[3]])).toEqual([
      ["AddToCart", { eventID: "same-operation" }],
      ["AddToCart", { eventID: "next-operation" }],
      ["ViewContent", { eventID: "same-operation" }],
    ]);
  });

  it("drops denied actions without replaying them after consent is granted", async () => {
    const { browser } = fakeBrowser();
    const pixel = await import("@/lib/analytics/meta-pixel");
    pixel.setMetaPixelConsent(false);
    pixel.trackAddToCart(commerceItem, "denied-action");
    expect(queuedCommands(browser).filter((command) => command[0] === "track")).toEqual([]);
    pixel.setMetaPixelConsent(true);
    pixel.trackAddToCart(commerceItem, "denied-action");
    pixel.trackAddToCart(commerceItem, "new-allowed-action");

    expect(queuedCommands(browser).filter((command) => command[1] === "AddToCart")).toEqual([
      ["track", "AddToCart", expect.any(Object), { eventID: "new-allowed-action" }],
    ]);
  });

  it("clears queued tracking when consent is revoked and does not replay it", async () => {
    const { browser } = fakeBrowser();
    const pixel = await import("@/lib/analytics/meta-pixel");
    pixel.trackAddToCart(commerceItem, "queued-before-revoke");
    pixel.setMetaPixelConsent(false);
    expect(queuedCommands(browser).filter((command) => command[0] === "track")).toEqual([]);
    expect(queuedCommands(browser)).toContainEqual(["consent", "revoke"]);
    pixel.setMetaPixelConsent(true);
    pixel.trackAddToCart(commerceItem, "queued-before-revoke");
    pixel.trackAddToCart(commerceItem, "post-grant-operation");
    expect(queuedCommands(browser).filter((command) => command[1] === "AddToCart")).toHaveLength(1);
  });

  it("tracks genuine later page visits while suppressing repeated effects and re-renders", async () => {
    const { browser } = fakeBrowser();
    const pixel = await import("@/lib/analytics/meta-pixel");
    pixel.trackPageView("/products/shirt");
    const firstView = pixel.getNavigationEventId("product", "/products/shirt");
    expect(pixel.getNavigationEventId("product", "/products/shirt")).toBe(firstView);
    pixel.trackPageView("/products/shirt");
    pixel.trackPageView("/cart");
    pixel.trackPageView("/products/shirt");
    const laterView = pixel.getNavigationEventId("product", "/products/shirt");

    expect(laterView).not.toBe(firstView);
    const views = queuedCommands(browser).filter((command) => command[1] === "PageView");
    expect(views).toHaveLength(3);
    expect(new Set(views.map((command) => (command[3] as { eventID: string }).eventID)).size).toBe(3);
  });

  it("uses only the standard InitiateCheckout event for a validated checkout snapshot", async () => {
    const { browser } = fakeBrowser();
    const pixel = await import("@/lib/analytics/meta-pixel");
    const snapshot = { items: [{ ...commerceItem, unitPrice: 12.5 }], currency: "USD" as const, value: 28.75 };
    pixel.trackInitiateCheckout(snapshot, "checkout-attempt");
    pixel.trackInitiateCheckout(snapshot, "checkout-attempt");
    expect(queuedCommands(browser).filter((command) => command[0] === "track")).toEqual([
      ["track", "InitiateCheckout", expect.objectContaining({
        contents: [{ id: "CATALOG-SHIRT", quantity: 2, item_price: 12.5 }],
        num_items: 2,
        value: 28.75,
        currency: "USD",
      }), { eventID: "checkout-attempt" }],
    ]);
  });

  it("persists Purchase deduplication only after SDK handoff across a document refresh", async () => {
    const { browser, storage, scripts } = fakeBrowser();
    const pixel = await import("@/lib/analytics/meta-pixel");
    const snapshot = purchaseSnapshot();
    pixel.trackPurchase(snapshot, snapshot.eventId);
    pixel.trackPurchase(snapshot, snapshot.eventId);
    expect(queuedCommands(browser).some((command) => command.includes("Purchase"))).toBe(false);
    expect(storage.size).toBe(0);
    const handoff = loadSdk(browser, scripts);
    expect(handoff).toHaveBeenCalledExactlyOnceWith(
      "trackSingle", "1234567890", "Purchase", expect.objectContaining({ value: 980, currency: "USD" }),
      { eventID: snapshot.eventId },
    );
    expect(storage.get(`enterfly:meta-purchase:1234567890:${snapshot.eventId}`)).toBe("sdk_handoff");
    pixel.trackPurchase(snapshot, snapshot.eventId);
    expect(handoff).toHaveBeenCalledTimes(1);

    vi.resetModules();
    const refreshed = fakeBrowser(storage);
    const reloadedPixel = await import("@/lib/analytics/meta-pixel");
    reloadedPixel.trackPurchase(snapshot, snapshot.eventId);
    const refreshedHandoff = loadSdk(refreshed.browser, refreshed.scripts);
    expect(refreshedHandoff).not.toHaveBeenCalled();
    const next = purchaseSnapshot({ eventId: "purchase:order-confirmed-2" });
    reloadedPixel.trackPurchase(next, next.eventId);
    expect(refreshedHandoff).toHaveBeenCalledExactlyOnceWith(
      "trackSingle", "1234567890", "Purchase", expect.any(Object), { eventID: next.eventId },
    );
  });

  it("retries a delayed Purchase with the same identity after refresh, without a queued sent marker", async () => {
    const initial = fakeBrowser();
    const pixel = await import("@/lib/analytics/meta-pixel");
    const snapshot = purchaseSnapshot();
    pixel.trackPurchase(snapshot, snapshot.eventId);
    expect(initial.storage.size).toBe(0);
    vi.resetModules();
    const refreshed = fakeBrowser(initial.storage);
    const reloadedPixel = await import("@/lib/analytics/meta-pixel");
    reloadedPixel.trackPurchase(snapshot, snapshot.eventId);
    const handoff = loadSdk(refreshed.browser, refreshed.scripts);
    expect(handoff).toHaveBeenCalledExactlyOnceWith(
      "trackSingle", "1234567890", "Purchase", expect.objectContaining({ value: 980, currency: "USD" }),
      { eventID: snapshot.eventId },
    );
  });

  it("captures an immutable purchase before cart clearing and suppresses repeated loading effects", async () => {
    const { browser, scripts } = fakeBrowser();
    const pixel = await import("@/lib/analytics/meta-pixel");
    const snapshot = purchaseSnapshot();
    pixel.trackPurchase(snapshot, snapshot.eventId);
    snapshot.value = 1500;
    snapshot.items[0].unitPrice = 999;
    snapshot.items.splice(0);
    pixel.trackPurchase(snapshot, snapshot.eventId);
    const handoff = loadSdk(browser, scripts);
    expect(handoff).toHaveBeenCalledExactlyOnceWith(
      "trackSingle", "1234567890", "Purchase", expect.objectContaining({
        value: 980, currency: "USD", contents: [{ id: "CATALOG-SHIRT", quantity: 2, item_price: 450 }],
      }), { eventID: snapshot.eventId },
    );
  });

  it.each([undefined, null, "", "980", "৳980", "980 BDT", "1,500", NaN, Infinity, -1, 0, 980.123])(
    "rejects an invalid purchase value %s without using the product sum", async (value) => {
      const { browser, scripts, storage } = fakeBrowser();
      const pixel = await import("@/lib/analytics/meta-pixel");
      const snapshot = purchaseSnapshot({ value });
      pixel.initializeMetaPixel();
      const handoff = loadSdk(browser, scripts);
      pixel.trackPurchase(snapshot, snapshot.eventId);
      expect(handoff).not.toHaveBeenCalled();
      expect(storage.size).toBe(0);
    },
  );

  it.each([undefined, null, "", "XYZ", "bdt"])('rejects unsupported purchase currency %s', async (currency) => {
    const { browser, scripts } = fakeBrowser();
    const pixel = await import("@/lib/analytics/meta-pixel");
    pixel.initializeMetaPixel();
    const handoff = loadSdk(browser, scripts);
    const snapshot = purchaseSnapshot({ currency });
    pixel.trackPurchase(snapshot, snapshot.eventId);
    expect(handoff).not.toHaveBeenCalled();
  });

  it("emits valid required parameters even when optional catalog metadata is missing", async () => {
    const { browser, scripts } = fakeBrowser();
    const pixel = await import("@/lib/analytics/meta-pixel");
    const snapshot = purchaseSnapshot({ items: [], value: 1500.25 });
    pixel.trackPurchase(snapshot, snapshot.eventId);
    const handoff = loadSdk(browser, scripts);
    expect(handoff).toHaveBeenCalledExactlyOnceWith(
      "trackSingle", "1234567890", "Purchase", { value: 1500.25, currency: "USD" }, { eventID: snapshot.eventId },
    );
  });

  it("rejects mismatched IDs and missing original conversion timestamps", async () => {
    const { browser, scripts } = fakeBrowser();
    const pixel = await import("@/lib/analytics/meta-pixel");
    pixel.initializeMetaPixel();
    const handoff = loadSdk(browser, scripts);
    const snapshot = purchaseSnapshot();
    pixel.trackPurchase(snapshot, "purchase:another-order");
    pixel.trackPurchase({ ...snapshot, eventTime: undefined }, snapshot.eventId);
    expect(handoff).not.toHaveBeenCalled();
  });

  it("retains a failed script attempt for a later load and retries the same immutable Purchase", async () => {
    const { browser, scripts, storage } = fakeBrowser();
    const pixel = await import("@/lib/analytics/meta-pixel");
    const snapshot = purchaseSnapshot();
    pixel.trackPurchase(snapshot, snapshot.eventId);
    (scripts[0].onerror as () => void)();
    expect(storage.size).toBe(0);
    pixel.trackPurchase(snapshot, snapshot.eventId);
    expect(scripts).toHaveLength(2);
    const handoff = loadSdk(browser, scripts);
    expect(handoff).toHaveBeenCalledTimes(1);
    expect(handoff.mock.calls[0].at(-1)).toEqual({ eventID: snapshot.eventId });
  });

  it("does not persist a throwing SDK attempt and allows a later handoff", async () => {
    const { browser, scripts, storage } = fakeBrowser();
    const pixel = await import("@/lib/analytics/meta-pixel");
    const snapshot = purchaseSnapshot();
    pixel.trackPurchase(snapshot, snapshot.eventId);
    browser.fbq!.callMethod = vi.fn(() => { throw new Error("blocked SDK"); });
    expect(() => (scripts[0].onload as () => void)()).not.toThrow();
    expect(storage.size).toBe(0);
    const successfulHandoff = vi.fn();
    browser.fbq!.callMethod = successfulHandoff;
    pixel.trackPurchase(snapshot, snapshot.eventId);
    expect(successfulHandoff).toHaveBeenCalledTimes(1);
    expect(storage.size).toBe(1);
  });

  it("preserves the saved amount and metadata when a failed SDK handoff mutates its parameters", async () => {
    const { browser, scripts, storage } = fakeBrowser();
    const pixel = await import("@/lib/analytics/meta-pixel");
    const snapshot = purchaseSnapshot();
    pixel.trackPurchase(snapshot, snapshot.eventId);
    browser.fbq!.callMethod = vi.fn((...args: unknown[]) => {
      const payload = args[3] as {
        value: number; currency: string; content_ids: string[]; variant_ids: string[];
        contents: { id: string; quantity: number; item_price: number }[];
      };
      payload.value = 1;
      payload.currency = "USD";
      payload.content_ids[0] = "mutated-product";
      payload.variant_ids[0] = "mutated-variant";
      payload.contents[0].item_price = 1;
      payload.contents[0].quantity = 99;
      throw new Error("SDK failed after mutation");
    });
    (scripts[0].onload as () => void)();
    expect(storage.size).toBe(0);
    const successfulHandoff = vi.fn();
    browser.fbq!.callMethod = successfulHandoff;
    pixel.trackPurchase(snapshot, snapshot.eventId);
    expect(successfulHandoff).toHaveBeenCalledExactlyOnceWith(
      "trackSingle", "1234567890", "Purchase", expect.objectContaining({
        value: 980, currency: "USD", content_ids: ["CATALOG-SHIRT"], variant_ids: ["variant-red-large"],
        contents: [{ id: "CATALOG-SHIRT", quantity: 2, item_price: 450 }],
      }), { eventID: snapshot.eventId },
    );
  });

  it("discards denied and revoked Purchase attempts permanently for this document", async () => {
    const { browser, scripts, storage } = fakeBrowser();
    const pixel = await import("@/lib/analytics/meta-pixel");
    const denied = purchaseSnapshot();
    pixel.setMetaPixelConsent(false);
    pixel.trackPurchase(denied, denied.eventId);
    pixel.setMetaPixelConsent(true);
    const revoked = purchaseSnapshot({ eventId: "purchase:revoked-order" });
    pixel.trackPurchase(revoked, revoked.eventId);
    pixel.setMetaPixelConsent(false);
    pixel.setMetaPixelConsent(true);
    const handoff = loadSdk(browser, scripts);
    handoff.mockClear();
    pixel.trackPurchase(denied, denied.eventId);
    pixel.trackPurchase(revoked, revoked.eventId);
    expect(handoff).not.toHaveBeenCalled();
    expect(storage.size).toBe(0);
  });

  it("preserves historical browser markers without replaying unknown former queue attempts", async () => {
    const { browser, scripts, storage } = fakeBrowser();
    const snapshot = purchaseSnapshot();
    storage.set(`enterfly:meta-purchase:1234567890:${snapshot.eventId}`, "1");
    const pixel = await import("@/lib/analytics/meta-pixel");
    pixel.trackPurchase(snapshot, snapshot.eventId);
    const handoff = loadSdk(browser, scripts);
    expect(handoff).not.toHaveBeenCalled();
    expect(storage.size).toBe(1);
  });

  it("does not let a throwing analytics adapter escape into business code", async () => {
    const { browser } = fakeBrowser();
    browser.fbq = vi.fn(() => { throw new Error("blocked analytics"); });
    const pixel = await import("@/lib/analytics/meta-pixel");
    expect(() => pixel.trackAddToCart(commerceItem, "safe-failure")).not.toThrow();
    expect(() => pixel.trackPageView("/cart")).not.toThrow();
  });
});

describe("confirmed cart operations emit AddToCart", () => {
  it("tracks a simple-product server success from canonical response data", async () => {
    const { browser } = fakeBrowser();
    const line = serverLine({ variantId: "default-variant", quantity: 5, unitPrice: 425 });
    const fetchMock = vi.fn().mockResolvedValue(envelopeResponse(line));
    vi.stubGlobal("fetch", fetchMock);
    const { createCartItemOnServer } = await import("@/features/cart/api");

    await expect(createCartItemOnServer("product-shirt", 1)).resolves.toEqual(line);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ productId: "product-shirt", quantity: 1 });
    expect(queuedCommands(browser).filter((command) => command[1] === "AddToCart")).toEqual([
      ["track", "AddToCart", expect.objectContaining({
        content_ids: ["CATALOG-SHIRT"],
        contents: [{ id: "CATALOG-SHIRT", quantity: 1, item_price: 425 }],
        value: 425,
        currency: "USD",
      }), { eventID: expect.any(String) }],
    ]);
  });

  it("does not label a server cart amount USD without server-confirmed pricing readiness", async () => {
    const { browser } = fakeBrowser();
    const line = serverLine();
    const response = new Response(JSON.stringify({ success: true, data: line }), { status: 201 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    const { createCartItemOnServer } = await import("@/features/cart/api");
    await expect(createCartItemOnServer("product-shirt")).resolves.toEqual(line);
    expect(queuedCommands(browser).filter((command) => command[1] === "AddToCart")).toEqual([]);
  });

  it("captures the submitted variant and quantity while selections change during the request", async () => {
    const { browser } = fakeBrowser();
    let completeRequest!: (response: Response) => void;
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(() => new Promise<Response>((resolve) => { completeRequest = resolve; }));
    vi.stubGlobal("fetch", fetchMock);
    const { createCartItemOnServer } = await import("@/features/cart/api");
    let selectedVariant = "variant-blue-small";
    selectedVariant = "variant-red-large";
    let quantity = 3;
    const operation = createCartItemOnServer("product-shirt", quantity, selectedVariant);
    selectedVariant = "variant-green-medium";
    quantity = 9;
    expect(queuedCommands(browser).filter((command) => command[1] === "AddToCart")).toEqual([]);
    completeRequest(envelopeResponse(serverLine()));
    await operation;

    expect(selectedVariant).toBe("variant-green-medium");
    expect(quantity).toBe(9);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      productId: "product-shirt", variantId: "variant-red-large", quantity: 3,
    });
    expect(queuedCommands(browser).filter((command) => command[1] === "AddToCart")).toEqual([
      ["track", "AddToCart", expect.objectContaining({
        contents: [{ id: "CATALOG-SHIRT", quantity: 3, item_price: 450 }],
        variant_ids: ["variant-red-large"],
        value: 1350,
      }), { eventID: expect.any(String) }],
    ]);
  });

  it("gives two independent successful additions of the same variant different event identities", async () => {
    const { browser } = fakeBrowser();
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(envelopeResponse(serverLine()))));
    const { addToCartOnServer } = await import("@/features/cart/api");
    await addToCartOnServer("product-shirt", 1, "variant-red-large");
    await addToCartOnServer("product-shirt", 1, "variant-red-large");
    const events = queuedCommands(browser).filter((command) => command[1] === "AddToCart");
    expect(events).toHaveLength(2);
    expect(events[0][3]).not.toEqual(events[1][3]);
  });

  it("deduplicates repeated cart callbacks that share an operation identity", async () => {
    const { browser } = fakeBrowser();
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(envelopeResponse(serverLine()))));
    const { createCartItemOnServer } = await import("@/features/cart/api");
    await createCartItemOnServer("product-shirt", 2, "variant-red-large", "retry-identity");
    await createCartItemOnServer("product-shirt", 2, "variant-red-large", "retry-identity");
    expect(queuedCommands(browser).filter((command) => command[1] === "AddToCart")).toEqual([
      ["track", "AddToCart", expect.objectContaining({ value: 900 }), { eventID: "retry-identity" }],
    ]);
  });

  it.each([
    ["missing required variant", 400, 1, undefined],
    ["unavailable stock", 409, 1, "variant-red-large"],
    ["invalid quantity", 400, 0, "variant-red-large"],
    ["failed server cart request", 503, 1, "variant-red-large"],
  ] as const)("emits nothing for %s", async (_reason, status, quantity, variantId) => {
    const { browser } = fakeBrowser();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(envelopeResponse(null, status)));
    const { createCartItemOnServer } = await import("@/features/cart/api");
    await expect(createCartItemOnServer("product-shirt", quantity, variantId)).rejects.toThrow("Cart rejected");
    expect(queuedCommands(browser).filter((command) => command[0] === "track")).toEqual([]);
  });

  it("emits nothing on a network failure and preserves the cart failure", async () => {
    const { browser } = fakeBrowser();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network offline")));
    const { createCartItemOnServer } = await import("@/features/cart/api");
    await expect(createCartItemOnServer("product-shirt", 1)).rejects.toThrow("Network offline");
    expect(queuedCommands(browser).filter((command) => command[0] === "track")).toEqual([]);
  });

  it("returns the successfully persisted cart line even if analytics throws", async () => {
    const { browser } = fakeBrowser();
    browser.fbq = vi.fn(() => { throw new Error("analytics unavailable"); });
    const line = serverLine();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(envelopeResponse(line)));
    const { createCartItemOnServer } = await import("@/features/cart/api");
    await expect(createCartItemOnServer("product-shirt", 2, "variant-red-large")).resolves.toEqual(line);
  });

  it("tracks only the actual persisted guest-cart increase when stock caps the addition", async () => {
    const { browser } = fakeBrowser();
    const { upsertLocalCartItem, writeLocalCart } = await import("@/features/cart/storage");
    const { trackLocalCartAddition } = await import("@/lib/analytics/meta-pixel");
    const before = [serverLine({ quantity: 4, stock: 5 })];
    const after = upsertLocalCartItem(before, serverLine({ quantity: 3, stock: 5 }));
    writeLocalCart(after);
    trackLocalCartAddition(before, after, "guest-stock-cap");
    trackLocalCartAddition(before, after, "guest-stock-cap");
    trackLocalCartAddition(after, after, "guest-no-change");
    trackLocalCartAddition(after, [], "guest-removal");

    expect(queuedCommands(browser).filter((command) => command[1] === "AddToCart")).toEqual([
      ["track", "AddToCart", expect.objectContaining({
        contents: [{ id: "CATALOG-SHIRT", quantity: 1, item_price: 450 }],
        value: 450,
      }), { eventID: "guest-stock-cap" }],
    ]);
  });

  it.each([
    ["zero stock", { stock: 0 }],
    ["inactive product", { status: "INACTIVE" as const }],
    ["quantity beyond stock", { quantity: 6, stock: 5 }],
  ])("does not report a guest addition with %s", async (_reason, overrides) => {
    const { browser } = fakeBrowser();
    const { trackLocalCartAddition } = await import("@/lib/analytics/meta-pixel");
    trackLocalCartAddition([], [serverLine({ quantity: 1, ...overrides })], "invalid-guest-action");
    expect(queuedCommands(browser).filter((command) => command[0] === "track")).toEqual([]);
  });
});

describe("payment purchase attribution", () => {
  const request: PlaceOrderRequest = {
    customerName: "Test buyer",
    customerPhone: "01700000000",
    customerAddress: "Test address",
    deliveryZone: "INSIDE_DHAKA",
    paymentMethod: "AIRWALLEX",
  };
  const result = { order: { id: "new-order", orderNumber: "TEST-ORDER" }, summary: {}, promo: null };

  it.each(["AIRWALLEX"] as const)("records intent only after a committed %s checkout and survives the gateway return", async (paymentMethod) => {
    const { browser, storage } = fakeBrowser();
    let finishRequest!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { finishRequest = resolve; })));
    const pixel = await import("@/lib/analytics/meta-pixel");
    const { placeCheckoutOrder } = await import("@/features/checkout/api");
    expect(pixel.hasPurchaseIntent("new-order")).toBe(false);
    const operation = placeCheckoutOrder({ ...request, paymentMethod });
    expect(pixel.hasPurchaseIntent("new-order")).toBe(false);
    finishRequest(envelopeResponse(result));
    await expect(operation).resolves.toEqual(result);
    expect(pixel.hasPurchaseIntent("new-order")).toBe(true);
    expect(queuedCommands(browser).filter((command) => command[1] === "Purchase")).toEqual([]);

    vi.resetModules();
    fakeBrowser(storage);
    const refreshed = await import("@/lib/analytics/meta-pixel");
    expect(refreshed.hasPurchaseIntent("new-order")).toBe(true);
    expect(refreshed.hasPurchaseIntent("historical-order")).toBe(false);
  });

  it("does not create intent after failed checkout or without granted consent", async () => {
    const { browser, storage } = fakeBrowser();
    const fetchMock = vi.fn().mockResolvedValueOnce(envelopeResponse(null, 503)).mockResolvedValueOnce(envelopeResponse(result));
    vi.stubGlobal("fetch", fetchMock);
    const { placeCheckoutOrder } = await import("@/features/checkout/api");
    const pixel = await import("@/lib/analytics/meta-pixel");
    await expect(placeCheckoutOrder(request)).rejects.toThrow("Cart rejected");
    expect(pixel.hasPurchaseIntent("new-order")).toBe(false);
    pixel.setMetaPixelConsent(false);
    await expect(placeCheckoutOrder(request)).resolves.toEqual(result);
    expect(pixel.hasPurchaseIntent("new-order")).toBe(false);
    expect(storage.size).toBe(0);
    expect(queuedCommands(browser).filter((command) => command[0] === "track")).toEqual([]);
  });

  it("clears pending purchase attribution from this and previous documents on consent revocation", async () => {
    const { storage } = fakeBrowser();
    const pixel = await import("@/lib/analytics/meta-pixel");
    storage.set("enterfly:meta-checkout:1234567890:prior-document-order", "1");
    storage.set("unrelated-storage", "preserved");
    pixel.registerPurchaseIntent("current-order");
    expect(pixel.hasPurchaseIntent("prior-document-order")).toBe(true);
    expect(pixel.hasPurchaseIntent("current-order")).toBe(true);
    pixel.setMetaPixelConsent(false);
    pixel.setMetaPixelConsent(true);
    expect(pixel.hasPurchaseIntent("prior-document-order")).toBe(false);
    expect(pixel.hasPurchaseIntent("current-order")).toBe(false);
    expect([...storage.keys()]).toEqual(["unrelated-storage"]);
    pixel.registerPurchaseIntent("later-order");
    expect(pixel.hasPurchaseIntent("later-order")).toBe(true);
  });

  it("keeps revoked intents unavailable when storage deletion throws and accepts a later new intent", async () => {
    const { browser, storage } = fakeBrowser();
    const pixel = await import("@/lib/analytics/meta-pixel");
    pixel.registerPurchaseIntent("old-order");
    browser.localStorage.removeItem = () => { throw new Error("Storage deletion denied"); };
    pixel.setMetaPixelConsent(false);
    pixel.setMetaPixelConsent(true);
    expect(storage.has("enterfly:meta-checkout:1234567890:old-order")).toBe(true);
    expect(pixel.hasPurchaseIntent("old-order")).toBe(false);
    pixel.registerPurchaseIntent("fresh-order");
    expect(pixel.hasPurchaseIntent("fresh-order")).toBe(true);
  });
});
