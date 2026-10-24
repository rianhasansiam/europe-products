
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
      <div className="rounded-2xl border border-brand-border bg-brand-white p-6 text-center text-sm text-brand-text-muted shadow-sm">
        {i18n("No categories available right now.")}</div>
    );
  }

  return (
    <div className="space-y-10">
      {categories.map((category, index) => (
        <section key={category.id} className="relative">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-foreground sm:text-xl">
                  <Link
                    href={`/categories/${category.path}`}
                    className="[overflow-wrap:anywhere] transition-colors hover:text-brand-red"
                  >
                    {category.name}
                  </Link>
                </h2>
                <p className="hidden text-xs text-brand-text-muted sm:block">
                  {category.totalProductCount} {i18n("products across this department")}</p>
              </div>
            </div>

            <Link
              href={`/categories/${category.path}`}
              className="group flex shrink-0 items-center gap-1 text-sm font-semibold text-brand-red transition-colors hover:text-brand-red-hover"
            >
              {i18n("View All")}<ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" />
            </Link>
          </div>

          <div className="mb-4 h-0.5 rounded-full bg-brand-border" />



          <div className="flex flex-col gap-4 lg:flex-row">
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
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
              className="inline-block max-w-full rounded-full bg-brand-red px-6 py-2.5 text-sm font-semibold text-brand-white shadow-md [overflow-wrap:anywhere] transition-all duration-300 hover:-translate-y-0.5 hover:bg-brand-red-hover hover:shadow-lg"
            >
              {i18n("View all {count, plural, one {# product} other {# products}}", { count: category.totalProductCount })}</Link>
          </div>

          {index < categories.length - 1 && (
            <div className="mt-8 border-b border-brand-border" />
          )}
        </section>
      ))}
    </div>
  );
}
