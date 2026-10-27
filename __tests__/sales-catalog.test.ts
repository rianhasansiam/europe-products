import { Decimal } from "@prisma/client/runtime/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  category: { findMany: vi.fn() },
  product: { findMany: vi.fn() },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: db }));

import { getCatalogFacets } from "@/lib/services/catalog-discovery.service";
import { parseProductsPageQuery, toProductQueryInput } from "@/lib/catalog/products-page-query";

beforeEach(() => vi.clearAllMocks());

describe("sales catalog browsing", () => {
  it("keeps category counts, selling price ranges and availability without catalog entities", async () => {
    db.category.findMany.mockResolvedValue([
      { id: "root", parentId: null, name: "Products", slug: "products", path: "products", depth: 0, position: 0, status: "ACTIVE" },
      { id: "child", parentId: "root", name: "Accessories", slug: "accessories", path: "products/accessories", depth: 1, position: 0, status: "ACTIVE" },
      { id: "hidden", parentId: null, name: "Hidden", slug: "hidden", path: "hidden", depth: 0, position: 1, status: "INACTIVE" },
    ]);
    db.product.findMany.mockResolvedValue([
      { categoryId: "root", salePrice: new Decimal(20), discountPrice: new Decimal(15), variants: [{ stock: 2 }] },
      { categoryId: "child", salePrice: new Decimal(40), discountPrice: null, variants: [{ stock: 0 }] },
    ]);

    const facets = await getCatalogFacets();

    expect(facets).toMatchObject({
      categories: [{ id: "root", directProductCount: 1, totalProductCount: 2, children: [{ id: "child", totalProductCount: 1 }] }],
      priceBounds: { min: 15, max: 40 },
      availability: { inStock: 1, outOfStock: 1 },
    });
    expect(facets).not.toHaveProperty("brands");
    expect(facets).not.toHaveProperty("manufacturers");
    expect(db.product.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: "ACTIVE", categoryId: { in: ["root", "child"] } },
    }));
  });

  it("ignores removed entity filters in old bookmarks while retaining active shopping filters", () => {
    const query = toProductQueryInput(parseProductsPageQuery(new URLSearchParams({
      brandSlug: "legacy-brand", manufacturerSlug: "legacy-maker",
      categoryPath: "accessories", minPrice: "10", maxPrice: "25", stock: "in-stock", page: "2",
    })));

    expect(query).toMatchObject({ categoryPath: "accessories", minPrice: 10, maxPrice: 25, stock: "in-stock", page: 2 });
    expect(query).not.toHaveProperty("brandSlug");
    expect(query).not.toHaveProperty("manufacturerSlug");
  });
});
