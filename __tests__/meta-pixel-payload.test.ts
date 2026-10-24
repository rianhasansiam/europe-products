import { describe, expect, it } from "vitest";

import {
  buildEcommercePayload,
  type CommerceItem,
} from "@/lib/analytics/ecommerce";
import type { CurrencyCode } from "@/lib/currency/config";

const item: CommerceItem = {
  productId: "internal-product-id",
  productCode: "CATALOG-100",
  variantId: "variant-red-large",
  sku: "RED-L",
  name: "Discounted shirt",
  quantity: 3,
  unitPrice: 899.5,
};

describe("Meta ecommerce payload construction", () => {
  it("uses catalog product codes and the newly added quantity at the effective price", () => {
    expect(buildEcommercePayload([item], "BDT")).toMatchObject({
      content_ids: ["CATALOG-100"],
      content_type: "product",
      contents: [{ id: "CATALOG-100", quantity: 3, item_price: 899.5 }],
      content_name: "Discounted shirt",
      currency: "BDT",
      value: 2698.5,
      num_items: 3,
      variant_ids: ["variant-red-large"],
    });
  });

  it("retains the existing internal product identifier for legacy lines without a code", () => {
    expect(
      buildEcommercePayload(
        [{ productId: "legacy-product", quantity: 2, unitPrice: 50.25 }],
        "USD",
      ),
    ).toMatchObject({
      content_ids: ["legacy-product"],
      contents: [{ id: "legacy-product", quantity: 2, item_price: 50.25 }],
      value: 100.5,
      currency: "USD",
      num_items: 2,
    });
  });

  it("uses an authoritative checkout total including its discount, shipping, and tax", () => {
    expect(
      buildEcommercePayload(
        [
          { ...item, quantity: 2, unitPrice: 12.5 },
          {
            productId: "product-2",
            productCode: "CATALOG-200",
            quantity: 1,
            unitPrice: 30,
          },
        ],
        "USD",
        57.35,
      ),
    ).toMatchObject({
      content_ids: ["CATALOG-100", "CATALOG-200"],
      contents: [
        { id: "CATALOG-100", quantity: 2, item_price: 12.5 },
        { id: "CATALOG-200", quantity: 1, item_price: 30 },
      ],
      num_items: 3,
      value: 57.35,
      currency: "USD",
    });
  });

  it("rounds monetary sums without changing major units", () => {
    expect(
      buildEcommercePayload(
        [{ productId: "fractional-price", quantity: 3, unitPrice: 0.1 }],
        "BDT",
      ),
    ).toMatchObject({ value: 0.3 });
  });

  it.each([
    ["empty identifier", { productId: "", quantity: 1, unitPrice: 10 }],
    ["zero quantity", { productId: "p", quantity: 0, unitPrice: 10 }],
    ["negative quantity", { productId: "p", quantity: -1, unitPrice: 10 }],
    ["fractional quantity", { productId: "p", quantity: 1.5, unitPrice: 10 }],
    ["nonfinite quantity", { productId: "p", quantity: Infinity, unitPrice: 10 }],
    ["negative price", { productId: "p", quantity: 1, unitPrice: -1 }],
    ["NaN price", { productId: "p", quantity: 1, unitPrice: NaN }],
    ["infinite price", { productId: "p", quantity: 1, unitPrice: Infinity }],
  ] satisfies Array<[string, CommerceItem]>)(
    "rejects %s instead of emitting a malformed conversion",
    (_description, invalidItem) => {
      expect(buildEcommercePayload([invalidItem], "BDT")).toBeNull();
    },
  );

  it("rejects empty snapshots, invalid currency, and invalid authoritative totals", () => {
    expect(buildEcommercePayload([], "BDT")).toBeNull();
    expect(buildEcommercePayload([item], "" as CurrencyCode)).toBeNull();
    expect(buildEcommercePayload([item], "BDT", NaN)).toBeNull();
    expect(buildEcommercePayload([item], "BDT", -1)).toBeNull();
  });
});
