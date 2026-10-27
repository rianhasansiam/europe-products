import { Decimal } from "@prisma/client/runtime/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  product: {
    findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(),
    update: vi.fn(), findUniqueOrThrow: vi.fn(),
  },
  category: { findUnique: vi.fn() },
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: db }));
vi.mock("@/lib/services/category.service", () => ({
  getCategoryBreadcrumbsByIds: async () => new Map(),
}));
vi.mock("@/lib/services/catalog-redirect.service", () => ({
  releaseCatalogRedirectSources: vi.fn(),
}));

import { createProduct, serializeProduct, updateProduct, type ProductWithCategory } from "@/lib/services/product.service";
import { createProductSchema, productQuerySchema, updateProductSchema } from "@/lib/validations/product.validation";

const storedProduct: ProductWithCategory = {
  id: "product-1", productCode: "PRD-00001", name: "Test product", slug: "test-product",
  description: null, descriptionBlocks: null, seoTitle: null, metaDescription: null,
  ogImage: null, gtin: null, itemCondition: "NEW", status: "ACTIVE", modelNumber: null,
  series: null, specifications: null, buyingPrice: new Decimal(70), salePrice: new Decimal(100),
  discountPrice: null, categoryId: "category-1", brandId: "legacy-brand", manufacturerId: "legacy-manufacturer",
  createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01"),
  category: { id: "category-1", name: "Category", slug: "category", path: "category", depth: 0,
    parentId: null, image: null, seoTitle: null, metaDescription: null, ogImage: null, status: "ACTIVE" },
  images: [], variants: [], reviews: [], categoryBreadcrumb: [],
};
const productInput = {
  name: "Test product", categoryId: "category-1", salePrice: 100,
  variants: [{ stock: 0 }],
};

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation(async (callback: (client: typeof db) => Promise<unknown>) => callback(db));
  db.product.findMany.mockResolvedValue([]);
  db.product.findFirst.mockResolvedValue(null);
  db.category.findUnique.mockResolvedValue({ id: "category-1" });
  db.product.create.mockResolvedValue(storedProduct);
  db.product.findUniqueOrThrow.mockResolvedValue(storedProduct);
  db.$queryRaw.mockResolvedValue([{ id: storedProduct.id, name: storedProduct.name, slug: storedProduct.slug }]);
});

describe("sales-only product management", () => {
  it("creates a product with selling prices and inventory without collecting source cost or catalog entities", async () => {
    const input = createProductSchema.parse(productInput);
    const result = await createProduct(input);
    const write = db.product.create.mock.calls[0][0].data;
    expect(write).toMatchObject({ salePrice: 100, buyingPrice: 0 });
    expect(write).not.toHaveProperty("brandId");
    expect(write).not.toHaveProperty("manufacturerId");
    expect(serializeProduct(result)).toMatchObject({ salePrice: 100, categoryId: "category-1" });
  });

  it("ignores removed fields in stale clients while preserving historical storage on a valid price update", async () => {
    const input = updateProductSchema.parse({ salePrice: 120, buyingPrice: 1, brandId: null, manufacturerId: null });
    await updateProduct(storedProduct.id, input);
    expect(db.product.update).toHaveBeenCalledWith({ where: { id: storedProduct.id }, data: { salePrice: 120 } });
  });

  it("does not accept a patch containing only retired fields", () => {
    expect(updateProductSchema.safeParse({ buyingPrice: 1, brandId: null, manufacturerId: null }).success).toBe(false);
  });

  it("does not expose historical source costs or entity assignments in product responses", () => {
    const result = serializeProduct(storedProduct);
    for (const key of ["buyingPrice", "brandId", "brand", "manufacturerId", "manufacturer"]) {
      expect(result).not.toHaveProperty(key);
    }
  });

  it("ignores retired brand and manufacturer filters while retaining sales price filtering", () => {
    const query = productQuerySchema.parse({ brandId: "old", brandSlug: "old", manufacturerId: "old", manufacturerSlug: "old", minPrice: "10" });
    expect(query).toMatchObject({ minPrice: 10 });
    for (const key of ["brandId", "brandSlug", "manufacturerId", "manufacturerSlug"]) expect(query).not.toHaveProperty(key);
  });
});
