import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { normalizeCartItem } from "@/features/cart/storage";
import { normalizeSavedItem } from "@/features/cart/saved-storage";
import { normalizeWishlistItem } from "@/features/wishlist/storage";

function sourceFile(path: string) {
  const source = readFileSync(resolve(path), "utf8");
  return ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function handler(path: string, name: string): string {
  const source = sourceFile(path);
  let body: string | undefined;
  function visit(node: ts.Node): void {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) {
      body = node.initializer?.getText(source);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (!body) throw new Error(`Missing business handler ${name} in ${path}`);
  return body;
}

const guestAdditionHandlers = [
  ["components/product/ProductCard.tsx", "handleAddToCart"],
  ["app/(shop)/products/components/ProductsGrid.tsx", "handleAddToCart"],
  ["app/(shop)/products/[slug]/components/ProductActions.tsx", "handleAddToCart"],
  ["app/(shop)/products/[slug]/components/RelatedProducts.tsx", "handleAddToBag"],
  ["app/(shop)/wishlist/page.tsx", "moveItemsToCart"],
  ["app/(shop)/wishlist/page.tsx", "handleSavedMoveToCart"],
  ["app/(shop)/cart/page.tsx", "handleSavedMoveToCart"],
] as const;

// The delivery suite exercises emitted names, payloads, quantities and counts.
// This inventory protects the multiple UI adapters from accidentally losing
// their successful-commit tracking boundary during a component-only change.
describe("every existing ecommerce entry point uses the canonical commit boundary", () => {
  it.each(guestAdditionHandlers)("tracks committed guest additions in %s:%s", (path, name) => {
    const body = handler(path, name);
    const commitPosition = body.lastIndexOf("writeLocalCart(");
    const trackPosition = body.indexOf("trackLocalCartAddition(");
    expect(commitPosition).toBeGreaterThan(-1);
    expect(trackPosition).toBeGreaterThan(commitPosition);
    expect(body.slice(commitPosition, trackPosition)).toContain("setCartData(");
    expect(body).not.toContain("trackAddToCart(");
    expect(body).not.toContain("fbq(");
  });

  it.each([
    "app/(shop)/cart/page.tsx",
    "app/(shop)/wishlist/page.tsx",
  ])("captures the saved-item operation identity before the queued callback in %s", (path) => {
    const body = handler(path, "handleSavedMoveToCart");
    expect(body.indexOf("const cartEventId = createEventId()")).toBeLessThan(body.indexOf("queueSavedRemoval("));
    expect(body).toMatch(/trackLocalCartAddition\([^;]+cartEventId\)/);
    expect(body).toMatch(/(?:addToCartOnServer|addCartItemOnServer)\(target\.productId, 1, target\.variantId, cartEventId\)/);
  });

  it("shares the PDP business handlers between regular and sticky mobile actions", () => {
    const source = sourceFile("app/(shop)/products/[slug]/components/ProductActions.tsx").text;
    expect(source.match(/void handleAddToCart\(\)/g)).toHaveLength(2);
    expect(source.match(/onClick=\{handleBuyNow\}/g)).toHaveLength(2);
  });

  it("keeps Buy Now as a cart-bypassing navigation until the destination validates checkout", () => {
    const body = handler("app/(shop)/products/[slug]/components/ProductActions.tsx", "handleBuyNow");
    expect(body).toContain("/checkout?buy=");
    expect(body).toContain("router.push(nextHref)");
    expect(body).not.toMatch(/track(?:AddToCart|InitiateCheckout|Purchase)\(/);
    expect(body).not.toContain("createCartItemOnServer(");
  });

  it("starts normal cart and profile checkout through the same validated destination", () => {
    const body = handler("app/(shop)/cart/page.tsx", "handleCheckout");
    expect(body).toContain("buildCartSelectionCheckoutHref(");
    expect(body).not.toContain("trackInitiateCheckout(");
    const profile = sourceFile("app/(shop)/profile/components/CartTab.tsx").text;
    expect(profile).toContain('href="/checkout"');
    expect(profile).not.toContain("trackInitiateCheckout(");
    const checkout = sourceFile("app/(shop)/checkout/page.tsx").text;
    expect(checkout.match(/trackInitiateCheckout\(/g)).toHaveLength(1);
    const identity = checkout.indexOf("const checkoutEventId = getNavigationEventId(");
    const request = checkout.indexOf("const next = await fetchCheckoutPreview(");
    const accepted = checkout.indexOf("if (ignore) return;", request);
    const event = checkout.indexOf("trackInitiateCheckout(", request);
    expect(identity).toBeLessThan(request);
    expect(accepted).toBeGreaterThan(request);
    expect(event).toBeGreaterThan(accepted);
    expect(checkout.slice(event, checkout.indexOf("setPaymentMethod(", event))).toContain("checkoutEventId");
  });

  it.each([
    ["components/product/ProductCard.tsx", "handleAddToCart"],
    ["app/(shop)/products/components/ProductsGrid.tsx", "handleAddToCart"],
    ["app/(shop)/products/[slug]/components/RelatedProducts.tsx", "handleAddToBag"],
  ])("routes required variant selection before any cart mutation in %s", (path, name) => {
    const body = handler(path, name);
    expect(body.indexOf("router.push(")).toBeLessThan(body.indexOf("createCartItemOnServer("));
  });

  it.each([
    ["components/product/ProductCard.tsx", "handleAddToCart", "inStock !== false && variantCount > 0"],
    ["app/(shop)/products/components/ProductsGrid.tsx", "handleAddToCart", "product.inStock && product.variantCount > 0"],
    ["app/(shop)/products/[slug]/components/RelatedProducts.tsx", "handleAddToBag", "product.inStock !== false && (product.variantCount ?? 1) > 0"],
  ])("does not convert known unavailable guest catalog actions in %s", (path, name, eligibility) => {
    const body = handler(path, name);
    const guard = body.indexOf(`if (${eligibility})`);
    const track = body.indexOf("trackLocalCartAddition(");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(track);
    // Analytics eligibility does not rewrite the existing local cart/UI flow.
    expect(body.indexOf("writeLocalCart(")).toBeLessThan(guard);
  });
});

describe("catalog identifiers survive persisted commerce snapshots", () => {
  it("preserves a cart product code when it becomes a saved item and returns later", () => {
    const cart = normalizeCartItem({
      id: "cart-1", productId: "internal-1", productCode: "CATALOG-1",
      name: "Product", quantity: 2, unitPrice: 75, stock: 5,
    });
    expect(cart?.productCode).toBe("CATALOG-1");
    const saved = normalizeSavedItem({ ...cart, price: cart?.unitPrice });
    expect(saved?.productCode).toBe("CATALOG-1");
  });

  it("retains the option-selection policy when a wishlist is restored from storage", () => {
    const wishlist = normalizeWishlistItem({
      id: "internal-1", productCode: "CATALOG-1", name: "Product",
      price: 75, variantCount: 3,
    });
    expect(wishlist).toMatchObject({ productCode: "CATALOG-1", variantCount: 3 });
  });
});
