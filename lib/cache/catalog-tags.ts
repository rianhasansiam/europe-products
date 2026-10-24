import "server-only";

/**
 * Canonical cache-tag vocabulary for public catalog data.
 *
 * Next.js limits tags to 256 characters. Category paths can be much longer,
 * so dynamic values are compacted with a deterministic hash when necessary.
 */
const MAX_CACHE_TAG_LENGTH = 256;

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function dynamicTag(prefix: string, value: string): string {
  const normalized = value.trim().toLowerCase();
  const tag = `${prefix}:${normalized}`;
  if (tag.length <= MAX_CACHE_TAG_LENGTH) return tag;

  const suffix = `:${stableHash(normalized)}`;
  return `${tag.slice(0, MAX_CACHE_TAG_LENGTH - suffix.length)}${suffix}`;
}

export const catalogCacheTags = {
  catalog: "catalog",
  listings: "catalog-listings",
  facets: "catalog-facets",
  categoryTree: "category-tree",
  brandDirectory: "brand-directory",
  homepage: "homepage",
  sitemap: "sitemap",
  redirects: "catalog-redirects",
  product: (id: string) => dynamicTag("product", id),
  productSlug: (slug: string) => dynamicTag("product-slug", slug),
  productReviews: (id: string) => dynamicTag("product-reviews", id),
  category: (id: string) => dynamicTag("category", id),
  categoryPath: (path: string) => dynamicTag("category-path", path),
  brand: (id: string) => dynamicTag("brand", id),
  brandSlug: (slug: string) => dynamicTag("brand-slug", slug),
  manufacturer: (id: string) => dynamicTag("manufacturer", id),
} as const;

export const CATALOG_LISTING_TAGS = [
  catalogCacheTags.catalog,
  catalogCacheTags.listings,
  catalogCacheTags.facets,
] as const;
