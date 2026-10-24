import "server-only";

import { unstable_cache } from "next/cache";

import { catalogCacheTags } from "@/lib/cache/catalog-tags";
import { prisma } from "@/lib/db/prisma";
import { getRequestLocale } from "@/lib/i18n/server";
import { localizeBannerSnapshots, localizeCategorySnapshots } from "@/lib/translations/public";

export type HomeCategoryProduct = {
  id: string;
  productCode: string;
  slug: string;
  name: string;
  description: string | null;
  price: number;
  discountPrice: number | null;
  image: string;
  images: string[];
  rating: number;
  reviewCount: number;
  badge: string | null;
  variantCount: number;
  inStock: boolean;
};

export type HomeCategoryLink = {
  id: string;
  name: string;
  path: string;
  totalProductCount: number;
};

export type HomeCategoryBanner = {
  id: string;
  image: string;
  label: string;
  heading: string;
  discount: string;
  description: string;
  link: string | null;
};

export type HomeCategory = {
  id: string;
  name: string;
  slug: string;
  path: string;
  image: string | null;
  totalProductCount: number;
  children: HomeCategoryLink[];
  products: HomeCategoryProduct[];
  categoryBanner: HomeCategoryBanner | null;
};

const FALLBACK_PRODUCT_IMAGE =
  "https://images.unsplash.com/photo-1542838132-92c53300491e?w=400";
const DEFAULT_CATEGORY_LIMIT = 6;
const DEFAULT_PRODUCTS_PER_CATEGORY = 8;

type CategoryRow = {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  path: string;
  image: string | null;
  status: "ACTIVE" | "INACTIVE";
  position: number;
};

function effectivelyActiveIds(categories: CategoryRow[]): Set<string> {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const memo = new Map<string, boolean>();

  const isActive = (category: CategoryRow): boolean => {
    const cached = memo.get(category.id);
    if (cached !== undefined) return cached;

    const visited = new Set<string>();
    let current: CategoryRow = category;
    while (true) {
      if (visited.has(current.id) || current.status !== "ACTIVE") {
        memo.set(category.id, false);
        return false;
      }
      visited.add(current.id);
      if (!current.parentId) break;
      const parent = byId.get(current.parentId);
      if (!parent) {
        memo.set(category.id, false);
        return false;
      }
      current = parent;
    }

    memo.set(category.id, true);
    return true;
  };

  return new Set(categories.filter(isActive).map((category) => category.id));
}

function descendantsOf(
  rootId: string,
  childrenByParent: Map<string, CategoryRow[]>,
): string[] {
  const output: string[] = [];
  const stack = [rootId];
  while (stack.length > 0) {
    const id = stack.pop();
    if (!id) continue;
    output.push(id);
    for (const child of childrenByParent.get(id) ?? []) stack.push(child.id);
  }
  return output;
}

function bannerMeta(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

const getCachedHomeCategories = unstable_cache(
  async (
    categoryLimit: number,
    productsPerCategory: number,
  ): Promise<HomeCategory[]> => {
    const categoryRows = await prisma.category.findMany({
      select: {
        id: true,
        parentId: true,
        name: true,
        slug: true,
        path: true,
        image: true,
        status: true,
        position: true,
      },
      orderBy: [{ position: "asc" }, { name: "asc" }],
    });

    const categories = categoryRows as CategoryRow[];
    const activeIds = effectivelyActiveIds(categories);
    const active = categories.filter((category) => activeIds.has(category.id));
    const childrenByParent = new Map<string, CategoryRow[]>();
    for (const category of active) {
      if (!category.parentId) continue;
      const siblings = childrenByParent.get(category.parentId) ?? [];
      siblings.push(category);
      childrenByParent.set(category.parentId, siblings);
    }

    const roots = active
      .filter((category) => category.parentId === null)
      .slice(0, categoryLimit);
    if (roots.length === 0) return [];

    const subtreeByRoot = new Map(
      roots.map((root) => [root.id, descendantsOf(root.id, childrenByParent)]),
    );
    const allSubtreeIds = Array.from(new Set([...subtreeByRoot.values()].flat()));

    const [directCounts, banners, productsByRoot] = await Promise.all([
      prisma.product.groupBy({
        by: ["categoryId"],
        where: { status: "ACTIVE", categoryId: { in: allSubtreeIds } },
        _count: { _all: true },
      }),
      prisma.banner.findMany({
        where: {
          type: "CATEGORY",
          status: "ACTIVE",
          categoryId: { in: roots.map((root) => root.id) },
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          categoryId: true,
          image: true,
          description: true,
          link: true,
          metadata: true,
        },
      }),
      Promise.all(
        roots.map(async (root) => ({
          rootId: root.id,
          rows: await prisma.product.findMany({
            where: {
              status: "ACTIVE",
              categoryId: { in: subtreeByRoot.get(root.id) ?? [root.id] },
            },
            orderBy: { createdAt: "desc" },
            take: productsPerCategory,
            select: {
              id: true,
              productCode: true,
              slug: true,
              name: true,
              description: true,
              salePrice: true,
              discountPrice: true,
              images: {
                orderBy: { position: "asc" },
                select: { url: true },
              },
              variants: { where: { isActive: true }, select: { id: true, stock: true } },
              reviews: { select: { rating: true } },
            },
          }),
        })),
      ),
    ]);

    const countByCategory = new Map(
      directCounts.map((row) => [row.categoryId, row._count._all]),
    );
    const totalFor = (categoryId: string) =>
      descendantsOf(categoryId, childrenByParent).reduce(
        (sum, id) => sum + (countByCategory.get(id) ?? 0),
        0,
      );

    const firstBannerByRoot = new Map<string, (typeof banners)[number]>();
    for (const banner of banners) {
      if (banner.categoryId && !firstBannerByRoot.has(banner.categoryId)) {
        firstBannerByRoot.set(banner.categoryId, banner);
      }
    }
    const productsMap = new Map(productsByRoot.map((entry) => [entry.rootId, entry.rows]));

    return roots.map((root) => {
      const banner = firstBannerByRoot.get(root.id);
      const meta = bannerMeta(banner?.metadata);
      const readMeta = (key: string) =>
        typeof meta[key] === "string" ? (meta[key] as string) : "";

      return {
        id: root.id,
        name: root.name,
        slug: root.slug,
        path: root.path,
        image: root.image,
        totalProductCount: totalFor(root.id),
        children: (childrenByParent.get(root.id) ?? []).map((child) => ({
          id: child.id,
          name: child.name,
          path: child.path,
          totalProductCount: totalFor(child.id),
        })),
        products: (productsMap.get(root.id) ?? []).map((product) => {
          const price = product.salePrice.toNumber();
          const sale = product.discountPrice?.toNumber() ?? null;
          const ratings = product.reviews.map((review) => review.rating);
          const imageUrls = product.images.map((image) => image.url);
          return {
            id: product.id,
            productCode: product.productCode,
            slug: product.slug,
            name: product.name,
            description: product.description,
            price,
            discountPrice: sale !== null && sale < price ? sale : null,
            image: imageUrls[0] ?? FALLBACK_PRODUCT_IMAGE,
            images: imageUrls,
            rating:
              ratings.length > 0
                ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
                : 0,
            reviewCount: ratings.length,
            badge: null,
            variantCount: product.variants.length,
            inStock: product.variants.some((variant) => variant.stock > 0),
          };
        }),
        categoryBanner: banner
          ? {
              id: banner.id,
              image: banner.image ?? "",
              label: readMeta("label"),
              heading: readMeta("heading"),
              discount: readMeta("discount"),
              description: banner.description ?? "",
              link: banner.link ?? `/categories/${root.path}`,
            }
          : null,
      };
    });
  },
  ["home-categories-v2"],
  {
    revalidate: 600,
    tags: [
      catalogCacheTags.homepage,
      catalogCacheTags.categoryTree,
    ],
  },
);

export async function getHomeCategories(options?: {
  categoryLimit?: number;
  productsPerCategory?: number;
}) {
  const original=await getCachedHomeCategories(
    options?.categoryLimit ?? DEFAULT_CATEGORY_LIMIT,
    options?.productsPerCategory ?? DEFAULT_PRODUCTS_PER_CATEGORY,
  );
  const locale=await getRequestLocale();
  const categories=await localizeCategorySnapshots(original,locale);
  const banners=await localizeBannerSnapshots(original.flatMap(category=>category.categoryBanner?[category.categoryBanner]:[]),locale);
  const byId=new Map(banners.map(banner=>[banner.id,banner]));
  return categories.map(category=>({...category,categoryBanner:category.categoryBanner?byId.get(category.categoryBanner.id)??category.categoryBanner:null}));
}
