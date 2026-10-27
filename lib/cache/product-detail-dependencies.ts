import { catalogCacheTags } from "@/lib/cache/catalog-tags";

type CategoryDependency = { id: string; path: string };
type SlugDependency = { id: string; slug: string };

export function productDetailCacheTags(input: {
  product: SlugDependency;
  category: CategoryDependency;
  categoryBreadcrumb: readonly CategoryDependency[];
  relatedProducts: readonly SlugDependency[];
}): string[] {
  return [
    catalogCacheTags.categoryTree,
    catalogCacheTags.product(input.product.id),
    catalogCacheTags.productSlug(input.product.slug),
    catalogCacheTags.productReviews(input.product.id),
    catalogCacheTags.category(input.category.id),
    catalogCacheTags.categoryPath(input.category.path),
    ...input.categoryBreadcrumb.flatMap((category) => [
      catalogCacheTags.category(category.id),
      catalogCacheTags.categoryPath(category.path),
    ]),
    ...input.relatedProducts.flatMap((related) => [
      catalogCacheTags.product(related.id),
      catalogCacheTags.productSlug(related.slug),
    ]),
  ];
}
