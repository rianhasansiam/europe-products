
import { useInterfaceTranslations } from "@/components/i18n/translate";
import { ChevronRight } from "lucide-react";
import Link from "@/lib/i18n/navigation";

import ProductCard from "@/components/product/ProductCard";
import type { HomeCategory } from "@/lib/services/home-categories.service";

import { CategoriesBanner } from "./CategoriesBanner";

type CategoriesProps = {
  initialCategories: HomeCategory[];
};

export default function Categories({ initialCategories }: CategoriesProps) {
  const i18n = useInterfaceTranslations("InterfaceComponentsCategories");
  const categories = initialCategories;

  if (categories.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground shadow-sm">
        {i18n("No categories available right now.")}</div>
    );
  }

  return (
    <div className="space-y-12">
      {categories.map((category, index) => (
        <section key={category.id} className="relative">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <div className="min-w-0">
                <h2 className="text-xl font-semibold text-foreground sm:text-2xl">
                  <Link
                    href={`/categories/${category.path}`}
                    className="[overflow-wrap:anywhere] transition-colors hover:text-primary"
                  >
                    {category.name}
                  </Link>
                </h2>
                <p className="hidden text-xs text-muted-foreground sm:block">
                  {category.totalProductCount} {i18n("products across this department")}</p>
              </div>
            </div>

            <Link
              href={`/categories/${category.path}`}
              className="group flex shrink-0 items-center gap-1 text-sm font-semibold text-primary transition-colors hover:text-primary-hover"
            >
              {i18n("View All")}<ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" />
            </Link>
          </div>

          <div className="mb-5 h-px bg-border" />



          <div className="flex flex-col gap-4 lg:flex-row">
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
              {category.products.map((item) => (
                <div key={item.id} className="min-w-0">
                  <ProductCard
                    id={item.id}
                    productCode={item.productCode}
                    slug={item.slug}
                    name={item.name}
                    price={item.discountPrice ?? item.price}
                    originalPrice={
                      item.discountPrice != null ? item.price : undefined
                    }
                    image={item.image}
                    rating={item.rating}
                    reviewCount={item.reviewCount}
                    badge={item.badge ?? undefined}
                    variantCount={item.variantCount}
                    inStock={item.inStock}
                  />
                </div>
              ))}
            </div>

            {category.categoryBanner && (
              <CategoriesBanner
                saleBanner={{
                  image: category.categoryBanner.image,
                  label: category.categoryBanner.label,
                  heading: category.categoryBanner.heading,
                  discount: category.categoryBanner.discount,
                  description: category.categoryBanner.description,
                  link:
                    category.categoryBanner.link ??
                    `/categories/${category.path}`,
                }}
              />
            )}
          </div>

          <div className="mt-5 text-center">
            <Link
              href={`/categories/${category.path}`}
              className="inline-flex min-h-11 max-w-full items-center justify-center rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground [overflow-wrap:anywhere] transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {i18n("View all {count, plural, one {# product} other {# products}}", { count: category.totalProductCount })}</Link>
          </div>

          {index < categories.length - 1 && (
            <div className="mt-8 border-b border-border" />
          )}
        </section>
      ))}
    </div>
  );
}
