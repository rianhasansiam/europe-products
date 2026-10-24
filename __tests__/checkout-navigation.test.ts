import { describe, expect, it } from "vitest";

import { buildCartSelectionCheckoutHref } from "@/features/checkout/promo";

describe("buildCartSelectionCheckoutHref", () => {
  it("preserves selected variants, quantities, cart intent, and promo code", () => {
    const href = buildCartSelectionCheckoutHref(
      [
        { productId: "product-1", variantId: "variant-1", quantity: 2 },
        { productId: "product-2", variantId: "variant-2", quantity: 3 },
      ],
      " save10 ",
    );
    const url = new URL(href, "https://bangbuy.test");

    expect(url.pathname).toBe("/checkout");
    expect(url.searchParams.get("source")).toBe("cart");
    expect(url.searchParams.get("buy")).toBe(
      "product-1:2:variant-1,product-2:3:variant-2",
    );
    expect(url.searchParams.get("promo")).toBe("SAVE10");
  });
});
