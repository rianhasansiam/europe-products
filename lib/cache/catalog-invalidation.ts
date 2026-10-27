import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { schedulePublicTranslationStaleness } from "@/lib/translations/invalidation";
import {
  CATALOG_LISTING_TAGS,
  catalogCacheTags,
} from "@/lib/cache/catalog-tags";

export type ProductInvalidationSnapshot = {
  id: string;
  slug: string;
  categoryId: string;
  categoryPath: string;
};

type InvalidationEntries = {
  tags?: Iterable<string>;
  paths?: Iterable<string>;
  reason: string;
};

function categoryAncestorPaths(path: string): string[] {
  const segments = path.split("/").filter(Boolean);
  return segments.map((_, index) => segments.slice(0, index + 1).join("/"));
}

function logInvalidationFailure(
  kind: "tag" | "path",
  key: string,
  reason: string,
  error: unknown,
) {
  console.error(`[catalog-cache] Failed to invalidate ${kind}`, {
    key,
    reason,
    error,
  });
}

/**
 * Best-effort invalidation primitive. Every entry is attempted independently;
 * callers can safely invoke it after a committed mutation without turning a
 * successful write into an HTTP 500 when the cache backend is unavailable.
 */
export function invalidateCatalogEntries({
  tags = [],
  paths = [],
  reason,
}: InvalidationEntries): void {
  for (const tag of new Set(tags)) {
    try {
      revalidateTag(tag, { expire: 0 });
    } catch (error) {
      logInvalidationFailure("tag", tag, reason, error);
    }
  }

  for (const path of new Set(paths)) {
    try {
      revalidatePath(path);
    } catch (error) {
      logInvalidationFailure("path", path, reason, error);
    }
  }
}

export async function loadProductInvalidationSnapshots(
  productIds: readonly string[],
): Promise<ProductInvalidationSnapshot[]> {
  const ids = [...new Set(productIds.filter(Boolean))];
  if (ids.length === 0) return [];

  try {
    const products = await prisma.product.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        slug: true,
        categoryId: true,
        category: { select: { path: true } },
      },
    });

    return products.map((product) => ({
      id: product.id,
      slug: product.slug,
      categoryId: product.categoryId,
      categoryPath: product.category.path,
    }));
  } catch (error) {
    console.error("[catalog-cache] Failed to load product dependencies", {
      productIds: ids,
      error,
    });
    return [];
  }
}

export function productInvalidationSnapshot(product: {
  id: string;
  slug: string;
  categoryId: string;
  category: { path: string };
}): ProductInvalidationSnapshot {
  return {
    id: product.id,
    slug: product.slug,
    categoryId: product.categoryId,
    categoryPath: product.category.path,
  };
}

export function invalidateProductSnapshots(
  snapshots: readonly ProductInvalidationSnapshot[],
  options: {
    reason: string;
    reviews?: boolean;
    sitemap?: boolean;
    categoryTree?: boolean;
  },
): void {
  schedulePublicTranslationStaleness("product",snapshots.map(snapshot=>snapshot.id));
  const tags = new Set<string>([
    ...CATALOG_LISTING_TAGS,
    catalogCacheTags.homepage,
  ]);
  const paths = new Set<string>(["/", "/products"]);

  if (options.sitemap) {
    tags.add(catalogCacheTags.sitemap);
    tags.add(catalogCacheTags.redirects);
    paths.add("/sitemap.xml");
  }
  if (options.categoryTree) tags.add(catalogCacheTags.categoryTree);

  for (const snapshot of snapshots) {
    tags.add(catalogCacheTags.product(snapshot.id));
    tags.add(catalogCacheTags.productSlug(snapshot.slug));
    if (options.reviews) {
      tags.add(catalogCacheTags.productReviews(snapshot.id));
    }
    paths.add(`/products/${snapshot.slug}`);

    tags.add(catalogCacheTags.category(snapshot.categoryId));
    for (const categoryPath of categoryAncestorPaths(snapshot.categoryPath)) {
      tags.add(catalogCacheTags.categoryPath(categoryPath));
      paths.add(`/categories/${categoryPath}`);
    }
  }

  invalidateCatalogEntries({ tags, paths, reason: options.reason });
}

export async function invalidateProductsById(
  productIds: readonly string[],
  options: {
    reason: string;
    previous?: readonly ProductInvalidationSnapshot[];
    reviews?: boolean;
    sitemap?: boolean;
    categoryTree?: boolean;
  },
): Promise<void> {
  const ids = [...new Set(productIds.filter(Boolean))];
  const current = await loadProductInvalidationSnapshots(ids);
  const resolvedIds = new Set(current.map((snapshot) => snapshot.id));
  const unresolvedIds = ids.filter((id) => !resolvedIds.has(id));

  // The dependency read is deliberately best effort, but the caller already
  // knows these IDs. Always expire their direct detail/review tags so a
  // successful price, stock, or review write cannot remain stale merely
  // because the post-commit relationship lookup failed.
  if (unresolvedIds.length > 0) {
    invalidateCatalogEntries({
      tags: unresolvedIds.flatMap((id) => [
        catalogCacheTags.product(id),
        ...(options.reviews ? [catalogCacheTags.productReviews(id)] : []),
      ]),
      reason: `${options.reason}: unresolved product dependencies`,
    });
  }

  invalidateProductSnapshots(
    [...(options.previous ?? []), ...current],
    options,
  );
}

export function invalidateCategoryMutation(input: {
  reason: string;
  categoryIds?: readonly string[];
  oldPaths?: readonly string[];
  newPaths?: readonly string[];
}): void {
  schedulePublicTranslationStaleness("category",input.categoryIds??[]);
  const tags = new Set<string>([
    ...CATALOG_LISTING_TAGS,
    catalogCacheTags.categoryTree,
    catalogCacheTags.redirects,
    catalogCacheTags.homepage,
    catalogCacheTags.sitemap,
  ]);
  const paths = new Set<string>([
    "/",
    "/products",
    "/categories",
    "/sitemap.xml",
  ]);

  for (const id of input.categoryIds ?? []) {
    tags.add(catalogCacheTags.category(id));
  }
  for (const path of [...(input.oldPaths ?? []), ...(input.newPaths ?? [])]) {
    if (!path) continue;
    tags.add(catalogCacheTags.categoryPath(path));
    paths.add(`/categories/${path}`);
  }

  invalidateCatalogEntries({ tags, paths, reason: input.reason });
  try {
    revalidatePath("/categories/[...segments]", "page");
  } catch (error) {
    logInvalidationFailure(
      "path",
      "/categories/[...segments]",
      input.reason,
      error,
    );
  }
}
