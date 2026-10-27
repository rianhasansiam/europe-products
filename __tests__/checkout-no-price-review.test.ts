import { Decimal } from "@prisma/client/runtime/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  products: vi.fn(), categories: vi.fn(), settings: vi.fn(),
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: { product: { findMany: mocks.products } } }));
vi.mock("@/lib/services/category.service", () => ({ getEffectiveActiveCategoryIds: mocks.categories }));
vi.mock("@/lib/services/settings.service", () => ({ getStoreSettings: mocks.settings, findActivePromoCode: vi.fn() }));

import { previewCheckout } from "@/lib/services/checkout.service";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.categories.mockResolvedValue(["category"]);
  mocks.products.mockResolvedValue([{
    id: "product", productCode: "PRD-1", name: "Product", status: "ACTIVE", categoryId: "category",
    salePrice: new Decimal(100), discountPrice: new Decimal(80), images: [],
    variants: [{ id: "variant", variantKey: "default", name: null, sku: null, modelNumber: null,
      color: null, size: null, attributes: null, stock: 10, isActive: true }],
  }]);
});

describe("checkout without manual price review", () => {
  it("prices current catalog items using saved selling prices regardless of the archived review flag", async () => {
    mocks.settings.mockResolvedValue({
      currency: "USD", pricingCurrencyVerified: false,
      taxRate: 0.05, standardShippingFee: 10, expressShippingFee: 20, freeShippingThreshold: 500,
    });
    const preview = await previewCheckout(null, {
      items: [{ productId: "product", variantId: "variant", quantity: 2 }],
      deliveryZone: "INSIDE_DHAKA",
    });

    expect(preview.items[0]).toMatchObject({ unitPrice: 80, originalPrice: 100, lineTotal: 160 });
    expect(preview.summary).toMatchObject({ currency: "USD", subtotal: 160, tax: 8, shipping: 10, total: 178 });
  });

  it("continues enforcing stock availability", async () => {
    await expect(previewCheckout(null, {
      items: [{ productId: "product", variantId: "variant", quantity: 11 }],
      deliveryZone: "INSIDE_DHAKA",
    })).rejects.toMatchObject({ status: 409, details: { productId: "product", available: 10 } });
    expect(mocks.settings).not.toHaveBeenCalled();
  });
});
