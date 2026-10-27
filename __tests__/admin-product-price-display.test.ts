import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "./helpers/intl";
import ProductsTable from "@/app/admin/products/components/ProductsTable";
import CurrencyProvider from "@/components/currency/CurrencyProvider";
import type { AdminProduct } from "@/features/admin-products/api";
import { DEFAULT_CURRENCY_CONTEXT } from "@/lib/currency/config";

describe("admin product pricing", () => {
  it("shows USD selling and discount prices even if an older page supplies an unverified state", () => {
    const product: AdminProduct = {
      id: "product", productCode: "PRD-00001", name: "Testing", slug: "testing",
      description: null, descriptionBlocks: null, seoTitle: null, metaDescription: null,
      ogImage: null, gtin: null, itemCondition: "NEW", modelNumber: null, series: null,
      specifications: null, salePrice: 4999.83, discountPrice: 2498.4,
      image: null, primaryImageAlt: null, images: [], rating: 0, reviewCount: 0,
      status: "ACTIVE", stock: 10, variants: [], createdAt: "2026-10-27T00:00:00.000Z",
      categoryId: "category", categoryBreadcrumb: [],
      category: { id: "category", name: "Category", slug: "category", path: "category", depth: 0, image: null },
    };
    const markup = renderToStaticMarkup(createElement(CurrencyProvider, {
      initialContext: { ...DEFAULT_CURRENCY_CONTEXT, pricingReady: false },
    }, createElement(ProductsTable, {
      products: [product], isLoading: false, totalCount: 1, busyActionProductId: null,
      onEdit: () => {}, onToggleHide: () => {}, onDelete: () => {},
    })));

    expect(markup).toContain("$2,498.40");
    expect(markup).toContain("$4,999.83");
    expect(markup).not.toContain("Review required");
  });
});
