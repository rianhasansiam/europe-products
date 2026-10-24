import { CART_LOCAL_STORAGE_KEY } from "@/features/cart/storage";
import { createTranslator as createIntlTranslator } from "next-intl";
import coreMessages from "@/messages/core-en.json";
import interfaceMessages from "@/messages/interface-en.json";
import adminMessages from "@/messages/admin-en.json";
import { isValidElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CartItem } from "@/features/cart/api";
import type { ProductVariantOption } from "@/app/(shop)/products/[slug]/components/ProductActions";

const harness = vi.hoisted(() => ({
  states: [] as unknown[],
  cursor: 0,
  authStatus: "authenticated",
  pricingReady: true,
  router: { push: vi.fn() },
  dispatch: vi.fn(),
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = harness.cursor++;
    if (index >= harness.states.length) harness.states.push(typeof initial === "function" ? initial() : initial);
    return [harness.states[index], (next: unknown) => {
      harness.states[index] = typeof next === "function" ? next(harness.states[index]) : next;
    }];
  },
  useMemo: (compute: () => unknown) => compute(),
  useCallback: (callback: unknown) => callback,
  useTransition: () => [false, (callback: () => void) => callback()],
}));
vi.mock("next/navigation", () => ({ useRouter: () => harness.router }));
vi.mock("@/lib/auth/use-app-session", () => ({
  useSession: () => ({ data: { user: { role: "USER" } }, status: harness.authStatus }),
}));
vi.mock("react-redux", () => ({
  useDispatch: () => harness.dispatch,
  useSelector: (selector: (state: { wishlist: { items: never[] } }) => unknown) => selector({ wishlist: { items: [] } }),
}));
vi.mock("@/lib/feedback", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/ui/loading", () => ({ ButtonLoader: () => null }));
vi.mock("@/components/currency/CurrencyAmount", () => ({ default: () => null }));
vi.mock("@/components/currency/CurrencyProvider", () => ({ useCurrency: () => ({ pricingReady: harness.pricingReady }) }));

type ButtonProps = {
  children?: ReactNode;
  disabled?: boolean;
  "aria-label"?: string;
  "aria-pressed"?: boolean;
  onClick: () => void;
};

function textContent(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(textContent).join("");
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (isValidElement<{ children?: ReactNode }>(node)) return textContent(node.props.children);
  return "";
}

function buttonsIn(node: ReactNode): ButtonProps[] {
  if (Array.isArray(node)) return node.flatMap(buttonsIn);
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  return [
    ...(node.type === "button" ? [node.props as ButtonProps] : []),
    ...buttonsIn(node.props.children),
  ];
}

const variants: ProductVariantOption[] = [
  {
    id: "variant-blue-small", variantKey: "blue-small", name: "Blue / Small",
    sku: "BLUE-S", modelNumber: null, color: "Blue", size: "Small", attributes: null,
    stock: 10, image: null, isActive: true,
  },
  {
    id: "variant-red-large", variantKey: "red-large", name: "Red / Large",
    sku: "RED-L", modelNumber: null, color: "Red", size: "Large", attributes: null,
    stock: 10, image: null, isActive: true,
  },
];

function createBrowser() {
  const storage = new Map<string, string>();
  const browser: {
    fbq?: ((...args: unknown[]) => void) & { queue?: unknown[][] };
    dispatchEvent: ReturnType<typeof vi.fn>;
    localStorage: { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void };
  } = {
    dispatchEvent: vi.fn(),
    localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => { storage.set(key, value); } },
  };
  vi.stubGlobal("window", Object.assign(browser, { __sexToyUsdPricingReady: true }));
  vi.stubGlobal("document", { createElement: () => ({}), head: { appendChild: vi.fn() } });
  vi.stubGlobal("CustomEvent", class { constructor(public type: string, public options: unknown) {} });
  return browser;
}

function events(browser: ReturnType<typeof createBrowser>): unknown[][] {
  return (browser.fbq?.queue ?? []).filter((command) => command[0] === "track");
}

async function renderActions(productVariants = variants) {
  const { default: ProductActions } = await import("@/app/(shop)/products/[slug]/components/ProductActions");
  harness.cursor = 0;
  return buttonsIn(ProductActions({
    productId: "product-shirt", productCode: "CATALOG-SHIRT", productSlug: "shirt", productName: "Shirt",
    category: "Clothing", rating: 4, reviewCount: 2, salePrice: 500, discountPrice: 450,
    variants: productVariants,
  }));
}

function byLabel(buttons: ButtonProps[], label: string) {
  const found = buttons.find((button) => button["aria-label"] === label || textContent(button.children).includes(label));
  if (!found) throw new Error(`Button not found: ${label}`);
  return found;
}

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify({ success: status < 400, data, message: "Rejected cart action" }), { status, headers: { "X-Store-Pricing-Ready": "true" } });
}

function savedLine(variantId = "variant-red-large", quantity = 3): CartItem {
  return {
    id: "server-cart-row", productId: "product-shirt", productCode: "CATALOG-SHIRT", variantId,
    name: "Shirt", image: null, quantity, unitPrice: 450, originalPrice: 500,
    lineTotal: quantity * 450, stock: 10, status: "ACTIVE",
  };
}

function mockSuccessfulFetch() {
  const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (_url, options) => {
    if (options?.method === "POST") {
      const submitted = JSON.parse(String(options.body)) as { variantId: string; quantity: number };
      return response(savedLine(submitted.variantId, submitted.quantity));
    }
    return response({ items: [], summary: { totalItems: 0, subtotal: 0, totalDiscount: 0, finalTotal: 0 } });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function settleOperation() {
  for (let index = 0; index < 10; index += 1) await Promise.resolve();
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "1234567890");
  harness.states = [];
  harness.authStatus = "authenticated";
  harness.pricingReady = true;
  harness.router.push.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("product action business guards and responsive entry points", () => {
  it("preselects the first active variant and enables both cart and Buy Now entry points", async () => {
    const browser = createBrowser();
    const fetchMock = mockSuccessfulFetch();
    const buttons = await renderActions([
      { ...variants[0], id: "inactive-variant", isActive: false },
      ...variants,
    ]);
    expect(byLabel(buttons, "Blue / Small")["aria-pressed"]).toBe(true);
    expect(byLabel(buttons, "Red / Large")["aria-pressed"]).toBe(false);
    const addButtons = buttons.filter((button) => textContent(button.children) === "Add to cart");
    expect(addButtons).toHaveLength(2);
    addButtons.forEach((button) => { expect(button.disabled).toBe(false); });
    const buyButtons = buttons.filter((button) => textContent(button.children).includes("Buy now"));
    expect(buyButtons).toHaveLength(2);
    buyButtons.forEach((button) => { expect(button.disabled).toBe(false); });
    await settleOperation();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(harness.router.push).not.toHaveBeenCalled();
    expect(events(browser)).toEqual([]);
  });

  it.each([["desktop", 0], ["sticky mobile", 1]] as const)("tracks the successful default-variant addition from the %s button", async (_entry, buttonIndex) => {
    const browser = createBrowser();
    const fetchMock = mockSuccessfulFetch();
    const buttons = await renderActions();
    const addButtons = buttons.filter((button) => textContent(button.children) === "Add to cart");
    expect(addButtons).toHaveLength(2);
    addButtons[buttonIndex].onClick();
    await settleOperation();
    const post = fetchMock.mock.calls.find((call) => call[1]?.method === "POST");
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ productId: "product-shirt", quantity: 1, variantId: "variant-blue-small" });
    expect(events(browser)).toEqual([
      ["track", "AddToCart", expect.objectContaining({
        content_ids: ["CATALOG-SHIRT"], variant_ids: ["variant-blue-small"],
        contents: [{ id: "CATALOG-SHIRT", quantity: 1, item_price: 450 }], value: 450,
      }), { eventID: expect.any(String) }],
    ]);
  });

  it("tracks the latest selected variant at submission and preserves it while the request is pending", async () => {
    const browser = createBrowser();
    let finishRequest!: (result: Response) => void;
    const fetchMock = vi.fn<typeof fetch>().mockImplementation((_url, options) => options?.method === "POST"
      ? new Promise<Response>((resolve) => { finishRequest = resolve; })
      : Promise.resolve(response({ items: [], summary: { totalItems: 0, subtotal: 0, totalDiscount: 0, finalTotal: 0 } })));
    vi.stubGlobal("fetch", fetchMock);
    let buttons = await renderActions();
    byLabel(buttons, "Blue / Small").onClick();
    buttons = await renderActions();
    byLabel(buttons, "Red / Large").onClick();
    buttons = await renderActions();
    byLabel(buttons, "Increase quantity").onClick();
    buttons = await renderActions();
    byLabel(buttons, "Increase quantity").onClick();
    buttons = await renderActions();
    byLabel(buttons, "Add to cart").onClick();
    buttons = await renderActions();
    byLabel(buttons, "Blue / Small").onClick();
    buttons = await renderActions();
    expect(byLabel(buttons, "Blue / Small")["aria-pressed"]).toBe(true);
    expect(events(browser)).toEqual([]);
    finishRequest(response(savedLine("variant-red-large", 7)));
    await settleOperation();
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ productId: "product-shirt", quantity: 3, variantId: "variant-red-large" });
    expect(events(browser)).toEqual([
      ["track", "AddToCart", expect.objectContaining({
        variant_ids: ["variant-red-large"], contents: [{ id: "CATALOG-SHIRT", quantity: 3, item_price: 450 }], value: 1350,
      }), { eventID: expect.any(String) }],
    ]);
  });

  it("keeps the first variant selected and blocks purchase when it is out of stock", async () => {
    const browser = createBrowser();
    const fetchMock = mockSuccessfulFetch();
    const buttons = await renderActions([{ ...variants[0], stock: 0 }, variants[1]]);
    expect(byLabel(buttons, "Blue / Small")["aria-pressed"]).toBe(true);
    expect(byLabel(buttons, "Add to cart").disabled).toBe(true);
    expect(byLabel(buttons, "Buy now").disabled).toBe(true);
    byLabel(buttons, "Add to cart").onClick();
    byLabel(buttons, "Buy now").onClick();
    await settleOperation();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(events(browser)).toEqual([]);
  });

  it("does not emit an optimistic event when the server rejects an addition", async () => {
    const browser = createBrowser();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(null, 409)));
    const buttons = await renderActions([variants[0]]);
    byLabel(buttons, "Add to cart").onClick();
    await settleOperation();
    expect(events(browser)).toEqual([]);
  });

  it("retains the successful addition when the following cart refresh fails", async () => {
    const browser = createBrowser();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response(savedLine("variant-blue-small", 1))).mockResolvedValueOnce(response(null, 503)));
    const buttons = await renderActions([variants[0]]);
    byLabel(buttons, "Add to cart").onClick();
    await settleOperation();
    expect(events(browser)).toEqual([
      ["track", "AddToCart", expect.objectContaining({ value: 450 }), { eventID: expect.any(String) }],
    ]);
  });

  it("tracks a persisted guest addition with the selected variant and effective discount price", async () => {
    const browser = createBrowser();
    harness.authStatus = "unauthenticated";
    const fetchMock = mockSuccessfulFetch();
    let buttons = await renderActions();
    byLabel(buttons, "Red / Large").onClick();
    buttons = await renderActions();
    byLabel(buttons, "Increase quantity").onClick();
    buttons = await renderActions();
    byLabel(buttons, "Add to cart").onClick();
    await settleOperation();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(JSON.parse(browser.localStorage.getItem(CART_LOCAL_STORAGE_KEY) ?? "[]")).toMatchObject([{ variantId: "variant-red-large", quantity: 2 }]);
    expect(events(browser)).toEqual([
      ["track", "AddToCart", expect.objectContaining({
        variant_ids: ["variant-red-large"], contents: [{ id: "CATALOG-SHIRT", quantity: 2, item_price: 450 }], value: 900,
      }), { eventID: expect.any(String) }],
    ]);
  });

  it("does not report unreviewed legacy cart prices as USD", async () => {
    const browser = createBrowser();
    harness.authStatus = "unauthenticated";
    harness.pricingReady = false;
    const buttons = await renderActions([variants[0]]);
    expect(byLabel(buttons, "Add to cart").disabled).toBe(true);
    expect(byLabel(buttons, "Buy now").disabled).toBe(true);
    byLabel(buttons, "Add to cart").onClick();
    byLabel(buttons, "Buy now").onClick();
    await settleOperation();
    expect(harness.router.push).not.toHaveBeenCalled();
    expect(events(browser)).toEqual([]);
    expect(JSON.parse(browser.localStorage.getItem(CART_LOCAL_STORAGE_KEY) ?? "[]")).toHaveLength(0);
  });

  it("Buy Now bypasses the cart and navigates without fabricating an event before checkout validation", async () => {
    const browser = createBrowser();
    const fetchMock = mockSuccessfulFetch();
    const buttons = await renderActions([variants[0]]);
    const buyButtons = buttons.filter((button) => textContent(button.children).includes("Buy now"));
    expect(buyButtons).toHaveLength(2);
    expect(buyButtons[0].onClick).toBe(buyButtons[1].onClick);
    buyButtons[1].onClick();
    expect(harness.router.push).toHaveBeenCalledWith("/checkout?buy=product-shirt%3A1%3Avariant-blue-small");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(events(browser)).toEqual([]);
  });

  it("lets a guest use both Buy Now entry points without signing in", async () => {
    createBrowser();
    harness.authStatus = "unauthenticated";
    const fetchMock = mockSuccessfulFetch();
    const buttons = await renderActions([variants[0]]);
    const buyButtons = buttons.filter((button) => textContent(button.children).includes("Buy now"));
    buyButtons[0].onClick();
    expect(harness.router.push).toHaveBeenCalledWith("/checkout?buy=product-shirt%3A1%3Avariant-blue-small");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

vi.mock("next-intl", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next-intl")>()),
  useLocale: () => "en",
  useTranslations: () => createIntlTranslator({ locale: "en", messages: { ...coreMessages, ...interfaceMessages, ...adminMessages } }),
}));
vi.mock("@/components/i18n/useLocaleDraft", () => ({ useLocaleDraft: () => undefined, useLocaleSwitchGuard: () => undefined }));
vi.mock("@/lib/i18n/navigation", async () => ({ ...(await import("next/navigation")), default: (await import("next/link")).default }));
