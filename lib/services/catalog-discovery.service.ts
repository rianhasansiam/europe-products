import "server-only";

import type { CategoryStatus } from "@/app/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import type { CatalogSearchQuery } from "@/lib/validations/catalog-discovery.validation";

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  path: string;
  depth: number;
  position: number;
  parentId: string | null;
  status: CategoryStatus;
};

export type CatalogCategoryFacet = {
  id: string;
  name: string;
  slug: string;
  path: string;
  depth: number;
  position: number;
  directProductCount: number;
  totalProductCount: number;
  children: CatalogCategoryFacet[];
};

export type CatalogEntityFacet = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  productCount: number;
};

function getEffectivelyActiveCategoryIds(categories: CategoryRow[]): Set<string> {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const memo = new Map<string, boolean>();

  const isVisible = (id: string, trail = new Set<string>()): boolean => {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;

    const category = byId.get(id);
    if (!category || category.status !== "ACTIVE" || trail.has(id)) {
      memo.set(id, false);
      return false;
    }

    if (!category.parentId) {
      memo.set(id, true);
      return true;
    }

    const nextTrail = new Set(trail);
    nextTrail.add(id);
    const visible = isVisible(category.parentId, nextTrail);
    memo.set(id, visible);
    return visible;
  };

  return new Set(categories.filter((category) => isVisible(category.id)).map((category) => category.id));
}

function buildBreadcrumb(
  categoryId: string,
  categoryById: Map<string, CategoryRow>,
): Array<{ id: string; name: string; slug: string; path: string }> {
  const result: Array<{ id: string; name: string; slug: string; path: string }> = [];
  const seen = new Set<string>();
  let cursor = categoryById.get(categoryId);

  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    result.push({
      id: cursor.id,
      name: cursor.name,
      slug: cursor.slug,
      path: cursor.path,
    });
    cursor = cursor.parentId ? categoryById.get(cursor.parentId) : undefined;
  }

  return result.reverse();
}

function descendantIds(
  parentId: string,
  childrenByParent: Map<string | null, CategoryRow[]>,
): string[] {
  const output: string[] = [];
  const stack = [...(childrenByParent.get(parentId) ?? [])];
  while (stack.length > 0) {
    const category = stack.pop();
    if (!category) continue;
    output.push(category.id);
    stack.push(...(childrenByParent.get(category.id) ?? []));
  }
  return output;
}

function buildCategoryFacetTree(
  categories: CategoryRow[],
  directCounts: Map<string, number>,
): CatalogCategoryFacet[] {
  const visibleIds = new Set(categories.map((category) => category.id));
  const childrenByParent = new Map<string | null, CategoryRow[]>();

  for (const category of categories) {
    const parentId = category.parentId && visibleIds.has(category.parentId)
      ? category.parentId
      : null;
    const siblings = childrenByParent.get(parentId) ?? [];
    siblings.push(category);
    childrenByParent.set(parentId, siblings);
  }

  for (const siblings of childrenByParent.values()) {
    siblings.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
  }

  const build = (category: CategoryRow): CatalogCategoryFacet => {
    const children = (childrenByParent.get(category.id) ?? []).map(build);
    const directProductCount = directCounts.get(category.id) ?? 0;
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      path: category.path,
      depth: category.depth,
      position: category.position,
      directProductCount,
      totalProductCount:
        directProductCount +
        children.reduce((total, child) => total + child.totalProductCount, 0),
      children,
    };
  };

  return (childrenByParent.get(null) ?? []).map(build);
}

async function loadCategoryRows(): Promise<CategoryRow[]> {
  return prisma.category.findMany({
    orderBy: [{ depth: "asc" }, { position: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      path: true,
      depth: true,
      position: true,
      parentId: true,
      status: true,
    },
  });
}

export async function getCatalogFacets() {
  const categories = await loadCategoryRows();
  const visibleCategoryIds = getEffectivelyActiveCategoryIds(categories);
  const visibleIds = [...visibleCategoryIds];

  const [products, brands, manufacturers] = await Promise.all([
    visibleIds.length === 0
      ? Promise.resolve([])
      : prisma.product.findMany({
          where: { status: "ACTIVE", categoryId: { in: visibleIds } },
          select: {
            categoryId: true,
            brandId: true,
            manufacturerId: true,
            salePrice: true,
            discountPrice: true,
            variants: {
              where: { isActive: true },
              select: { stock: true },
            },
          },
        }),
    prisma.brand.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, logo: true },
    }),
    prisma.manufacturer.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, logo: true },
    }),
  ]);

  const directCounts = new Map<string, number>();
  const brandCounts = new Map<string, number>();
  const manufacturerCounts = new Map<string, number>();
  let inStock = 0;
  let outOfStock = 0;
  let minPrice = Number.POSITIVE_INFINITY;
  let maxPrice = 0;

  for (const product of products) {
    directCounts.set(product.categoryId, (directCounts.get(product.categoryId) ?? 0) + 1);
    if (product.brandId) {
      brandCounts.set(product.brandId, (brandCounts.get(product.brandId) ?? 0) + 1);
    }
    if (product.manufacturerId) {
      manufacturerCounts.set(
        product.manufacturerId,
        (manufacturerCounts.get(product.manufacturerId) ?? 0) + 1,
      );
    }

    const salePrice = product.salePrice.toNumber();
    const discountPrice = product.discountPrice?.toNumber() ?? null;
    const effectivePrice =
      discountPrice != null && discountPrice < salePrice ? discountPrice : salePrice;
    minPrice = Math.min(minPrice, effectivePrice);
    maxPrice = Math.max(maxPrice, effectivePrice);

    if (product.variants.some((variant) => variant.stock > 0)) inStock += 1;
    else outOfStock += 1;
  }

  const visibleCategories = categories.filter((category) => visibleCategoryIds.has(category.id));

  return {
    categories: buildCategoryFacetTree(visibleCategories, directCounts),
    brands: brands.map((brand): CatalogEntityFacet => ({
      ...brand,
      productCount: brandCounts.get(brand.id) ?? 0,
    })),
    manufacturers: manufacturers.map((manufacturer): CatalogEntityFacet => ({
      ...manufacturer,
      productCount: manufacturerCounts.get(manufacturer.id) ?? 0,
    })),
    priceBounds: {
      min: Number.isFinite(minPrice) ? Math.floor(minPrice) : 0,
      max: Math.ceil(maxPrice),
    },
    availability: { inStock, outOfStock },
  };
}

export async function searchCatalog(query: CatalogSearchQuery) {
  const categories = await loadCategoryRows();
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const visibleCategoryIds = getEffectivelyActiveCategoryIds(categories);
  const visibleCategories = categories.filter((category) => visibleCategoryIds.has(category.id));
  const childrenByParent = new Map<string | null, CategoryRow[]>();

  for (const category of visibleCategories) {
    const siblings = childrenByParent.get(category.parentId) ?? [];
    siblings.push(category);
    childrenByParent.set(category.parentId, siblings);
  }

  const normalizedQuery = query.q.toLocaleLowerCase();
  const slugQuery = normalizedQuery.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const matchingCategories = visibleCategories.filter(
    (category) =>
      category.name.toLocaleLowerCase().includes(normalizedQuery) ||
      category.path.toLocaleLowerCase().includes(normalizedQuery) ||
      (slugQuery.length > 0 && category.path.toLocaleLowerCase().includes(slugQuery)),
  );
  const ancestryCategoryIds = new Set<string>();
  for (const category of matchingCategories) {
    ancestryCategoryIds.add(category.id);
    for (const id of descendantIds(category.id, childrenByParent)) ancestryCategoryIds.add(id);
  }

  const visibleIds = [...visibleCategoryIds];
  const products = visibleIds.length === 0
    ? []
    : await prisma.product.findMany({
        where: {
          status: "ACTIVE",
          categoryId: { in: visibleIds },
          OR: [
            { name: { contains: query.q, mode: "insensitive" } },
            { productCode: { contains: query.q, mode: "insensitive" } },
            { modelNumber: { contains: query.q, mode: "insensitive" } },
            { series: { contains: query.q, mode: "insensitive" } },
            { brand: { name: { contains: query.q, mode: "insensitive" } } },
            { manufacturer: { name: { contains: query.q, mode: "insensitive" } } },
            { category: { name: { contains: query.q, mode: "insensitive" } } },
            { category: { path: { contains: slugQuery || query.q, mode: "insensitive" } } },
            ...(ancestryCategoryIds.size > 0
              ? [{ categoryId: { in: [...ancestryCategoryIds] } }]
              : []),
          ],
        },
        orderBy: [{ createdAt: "desc" }, { name: "asc" }],
        take: query.productLimit,
        select: {
          id: true,
          slug: true,
          productCode: true,
          name: true,
          modelNumber: true,
          series: true,
          salePrice: true,
          discountPrice: true,
          categoryId: true,
          category: { select: { id: true, name: true, slug: true, path: true, image: true } },
          brand: { select: { id: true, name: true, slug: true } },
          manufacturer: { select: { id: true, name: true, slug: true } },
          images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
          variants: {
            where: { isActive: true },
            select: { stock: true },
          },
        },
      });

  const productIds = products.map((product) => product.id);
  const [reviewGroups, directProductGroups] = await Promise.all([
    productIds.length === 0
      ? Promise.resolve([])
      : prisma.review.groupBy({
          by: ["productId"],
          where: { productId: { in: productIds } },
          _avg: { rating: true },
          _count: { _all: true },
        }),
    visibleIds.length === 0
      ? Promise.resolve([])
      : prisma.product.groupBy({
          by: ["categoryId"],
          where: { status: "ACTIVE", categoryId: { in: visibleIds } },
          _count: { _all: true },
        }),
  ]);

  const reviewsByProduct = new Map(
    reviewGroups.map((group) => [
      group.productId,
      { rating: group._avg.rating ?? 0, reviewCount: group._count._all },
    ]),
  );
  const directCounts = new Map(
    directProductGroups.map((group) => [group.categoryId, group._count._all]),
  );
  const facetTree = buildCategoryFacetTree(visibleCategories, directCounts);
  const totalsByCategory = new Map<string, number>();
  const indexTotals = (nodes: CatalogCategoryFacet[]) => {
    for (const node of nodes) {
      totalsByCategory.set(node.id, node.totalProductCount);
      indexTotals(node.children);
    }
  };
  indexTotals(facetTree);

  return {
    query: query.q,
    products: products.map((product) => {
      const price = product.salePrice.toNumber();
      const rawDiscount = product.discountPrice?.toNumber() ?? null;
      const discountPrice = rawDiscount != null && rawDiscount < price ? rawDiscount : null;
      const metrics = reviewsByProduct.get(product.id) ?? { rating: 0, reviewCount: 0 };
      return {
        id: product.id,
        slug: product.slug,
        productCode: product.productCode,
        name: product.name,
        modelNumber: product.modelNumber,
        series: product.series,
        price,
        discountPrice,
        image: product.images[0]?.url ?? null,
        stock: product.variants.reduce((total, variant) => total + variant.stock, 0),
        rating: metrics.rating,
        reviewCount: metrics.reviewCount,
        category: product.category,
        categoryBreadcrumb: buildBreadcrumb(product.categoryId, categoryById),
        brand: product.brand,
        manufacturer: product.manufacturer,
      };
    }),
    categories: matchingCategories
      .sort((a, b) => a.depth - b.depth || a.position - b.position || a.name.localeCompare(b.name))
      .slice(0, query.categoryLimit)
      .map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        path: category.path,
        depth: category.depth,
        totalProductCount: totalsByCategory.get(category.id) ?? 0,
        breadcrumb: buildBreadcrumb(category.id, categoryById),
      })),
  };
}
