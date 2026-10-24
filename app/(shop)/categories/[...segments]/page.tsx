
import { getInterfaceTranslations } from "@/components/i18n/server";
import type { Metadata } from "next";
import { ArrowRight, Boxes } from "lucide-react";
import Image from "next/image";
import Link from "@/lib/i18n/navigation";
import { notFound, permanentRedirect } from "next/navigation";

import { cache } from "react";
import { getRequestLocale } from "@/lib/i18n/server";
import { localizeCategorySnapshots } from "@/lib/translations/public";
import PublicContentNotice from "@/components/i18n/PublicContentNotice";

import ProductCard from "@/components/product/ProductCard";
import JsonLd from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, collectionPageJsonLd } from "@/lib/seo/json-ld";
import {
  categoryFallbackDescription,
  categoryFallbackTitle,
} from "@/lib/seo/catalog-metadata";
import { noIndexMetadata } from "@/lib/seo/metadata";
import { buildLocalizedMetadata } from "@/lib/seo/localized-metadata";
import { getPublishedEntityLocales } from "@/lib/translations/service";
import { getTranslations } from "next-intl/server";
import {
  getActiveCategoryByPath,
  getActiveCategoryTree,
  getCategoryRedirectByPath,
  normalizeCategoryPath,
  type CategoryDto,
  type PublicCategoryProduct,
} from "@/lib/services/category.service";

export const revalidate = 1800;
export const dynamicParams = true;

type Props = {
  params: Promise<{ segments: string[] }>;
};

const FALLBACK_PRODUCT_IMAGE =
  "https://images.unsplash.com/photo-1542838132-92c53300491e?w=400";
const CATEGORY_STATIC_PARAM_LIMIT = 100;

const getCategoryPageData = cache(async(path:string)=>{const category=await getActiveCategoryByPath(path);return category?(await localizeCategorySnapshots([category],await getRequestLocale()))[0]:null;});

function pathFromSegments(segments: string[]): string {
  return normalizeCategoryPath(segments.join("/"));
}

function collectCategoryParams(
  categories: CategoryDto[],
): { segments: string[]; productCount: number }[] {
  return categories.flatMap((category) => [
    {
      segments: category.path.split("/").filter(Boolean),
      productCount: category.totalProductCount,
    },
    ...collectCategoryParams(category.children ?? []),
  ]);
}

export async function generateStaticParams() {
  return collectCategoryParams(await getActiveCategoryTree())
    .sort((left, right) => right.productCount - left.productCount)
    .slice(0, CATEGORY_STATIC_PARAM_LIMIT)
    .map(({ segments }) => ({ segments }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await getRequestLocale();
  const translate = await getTranslations("Seo");
  const { segments } = await params;
  const rawRequestedPath = segments.join("/");
  const requestedPath = pathFromSegments(segments);
  const category = await getCategoryPageData(requestedPath);

  if (!category) {
    const redirectRecord = await getCategoryRedirectByPath(requestedPath);
    if (redirectRecord) permanentRedirect(redirectRecord.destinationPath);
    return noIndexMetadata(
      "Category unavailable",
      "This category is unavailable or no longer published.",
    );
  }
  if (rawRequestedPath !== category.path) {
    permanentRedirect(`/categories/${category.path}`);
  }

  const description =
    category.metaDescription?.trim() ||
    categoryFallbackDescription({
      name: category.name,
      path: category.path,
      breadcrumb: category.breadcrumb,
      description: category.description,
      totalProductCount: category.totalProductCount,
    }, locale, translate);

  const readyLocales = await getPublishedEntityLocales("category", [category.id], ["name", "description", "seoTitle", "metaDescription"]);
  return buildLocalizedMetadata({
    title:
      category.seoTitle?.trim() ||
      categoryFallbackTitle({
        name: category.name,
        path: category.path,
        breadcrumb: category.breadcrumb,
      }, locale, translate),
    description,
    path: `/categories/${category.path}`,
    image: category.ogImage?.trim() || category.image,
    keywords: [category.name, ...category.breadcrumb.map((item) => item.name)],
    preparedLocales: readyLocales.get(category.id) ?? [],
    index: category.translationAvailable,
  }, "InterfaceCategoriesSegmentsPage");
}

export default async function CategoryPage({ params }: Props) {
  const locale = await getRequestLocale();
  const i18n = await getInterfaceTranslations("InterfaceCategoriesSegmentsPage");
  const { segments } = await params;
  const rawRequestedPath = segments.join("/");
  const requestedPath = pathFromSegments(segments);
  const category = await getCategoryPageData(requestedPath);
  if (!category) {
    const redirectRecord = await getCategoryRedirectByPath(requestedPath);
    if (redirectRecord) permanentRedirect(redirectRecord.destinationPath);
    notFound();
  }
  if (rawRequestedPath !== category.path) {
    permanentRedirect(`/categories/${category.path}`);
  }

  const categoryPath = `/categories/${category.path}`;
  const crumbs = [
    { name: i18n("Home"), path: "/" },
    { name: i18n("Categories"), path: "/categories" },
    ...category.breadcrumb.map((item) => ({
      name: item.name,
      path: `/categories/${item.path}`,
    })),
    { name: category.name, path: categoryPath },
  ];

  return (
    <main className="min-h-screen bg-brand-light-bg">
      <JsonLd
        data={[
          collectionPageJsonLd({
            name: category.name,
            description: category.description,
            path: categoryPath,
            locale,
          }),
          breadcrumbJsonLd(crumbs, locale),
        ]}
      />

      <div className="mx-auto max-w-7xl px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
        <PublicContentNotice available={category.translationAvailable}/>
        <nav aria-label={i18n("Breadcrumb")} className="mb-5 text-sm text-gray-500">
          <ol className="flex min-w-0 flex-wrap items-center gap-1.5">
            {crumbs.map((crumb, index) => {
              const current = index === crumbs.length - 1;
              return (
                <li
                  key={crumb.path}
                  className="flex min-w-0 max-w-full items-center gap-1.5"
                >
                  {index > 0 && <span aria-hidden className="shrink-0">/</span>}
                  {current ? (
                    <span
                      aria-current="page"
                      className="min-w-0 font-medium text-gray-800 [overflow-wrap:anywhere]"
                    >
                      {crumb.name}
                    </span>
                  ) : (
                    <Link
                      href={crumb.path}
                      className="min-w-0 [overflow-wrap:anywhere] hover:text-brand-red"
                    >
                      {crumb.name}
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        {/* <header className="mb-7 overflow-hidden rounded-2xl border border-brand-border bg-white shadow-sm">
          <div className="flex min-h-44 flex-col justify-center gap-5 p-6 sm:flex-row sm:items-center sm:justify-between lg:p-8">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-widest text-brand-red">
                Category collection
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-950 sm:text-4xl">
                {category.name}
              </h1>
              {category.description && (
                <p className="mt-3 text-sm leading-6 text-gray-600 sm:text-base">
                  {category.description}
                </p>
              )}
              <p className="mt-3 text-sm font-semibold text-gray-700">
                {category.totalProductCount}{" "}
                {category.totalProductCount === 1 ? "product" : "products"}
                {category.childCount > 0
                  ? ` across ${category.childCount} immediate subcategories`
                  : ""}
              </p>
            </div>
            {category.image ? (
              <div className="relative h-32 w-full shrink-0 overflow-hidden rounded-xl bg-brand-light-bg sm:w-56">
                <Image
                  src={category.image}
                  alt={`${category.name} category`}
                  fill
                  sizes="(min-width: 640px) 224px, calc(100vw - 4.5rem)"
                  preload
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-brand-red/10">
                <Boxes className="h-10 w-10 text-brand-red" />
              </div>
            )}
          </div>
        </header> */}

        {category.children.length > 0 && (
          <section aria-labelledby="subcategory-heading" className="mb-9">
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2
                id="subcategory-heading"
                className="min-w-0 flex-1 text-xl font-extrabold text-gray-950 [overflow-wrap:anywhere]"
              >
                {i18n("Explore")}{category.name}
              </h2>
              <Link
                href={`/products?categoryPath=${encodeURIComponent(category.path)}`}
                className="shrink-0 text-end text-sm font-semibold text-brand-red hover:text-brand-red-hover"
              >
                {i18n("Filter all products")}</Link>
            </div>
            <div className="-mx-3 flex snap-x snap-proximity gap-4 overflow-x-auto px-3 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-3 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3 xl:grid-cols-4">
              {category.children.map((child) => (
                <Link
                  key={child.id}
                  href={`/categories/${child.path}`}
                  className="group flex w-24 shrink-0 snap-start flex-col items-center text-center transition hover:-translate-y-0.5 sm:w-auto sm:min-w-0 sm:flex-row sm:gap-3 sm:rounded-xl sm:border sm:border-brand-border sm:bg-white sm:p-4 sm:text-start sm:shadow-sm sm:hover:border-brand-red/30 sm:hover:shadow-md"
                >
                  <span className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-brand-border bg-brand-light-bg shadow-sm transition-colors group-hover:border-brand-red/40 sm:size-16 sm:shadow-none">
                    {child.image ? (
                      <Image
                        src={child.image}
                        alt=""
                        fill
                        sizes="(min-width: 640px) 64px, 80px"
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <Boxes className="h-8 w-8 text-brand-red/60 sm:h-7 sm:w-7" />
                    )}
                  </span>

                  <div className="mt-2 w-full min-w-0 sm:mt-0 sm:flex-1">
                    <h3 className="line-clamp-2 min-h-8 text-xs font-bold leading-4 text-gray-900 group-hover:text-brand-red sm:line-clamp-1 sm:min-h-0 sm:text-base">
                      {child.name}
                    </h3>
                    <p className="mt-2 text-[11px] text-gray-500 sm:mt-1 sm:text-xs">
                      {child.totalProductCount}{" "}
                      {child.totalProductCount === 1 ? i18n("product") : i18n("products")}
                    </p>
                  </div>
                  <ArrowRight className="hidden h-4 w-4 shrink-0 text-brand-red transition group-hover:translate-x-1 sm:block rtl:rotate-180" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {category.products.length === 0 ? (
          <div className="rounded-2xl border border-brand-border bg-white p-10 text-center shadow-sm">
            <h2 className="text-lg font-bold text-gray-900">{i18n("No products yet")}</h2>
            <p className="mt-2 text-sm text-gray-600">
              {i18n("There are no visible products in this category or its subcategories right now.")}</p>
            <Link
              href="/products"
              className="mt-5 inline-flex rounded-full bg-brand-red px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-red-hover"
            >
              {i18n("Browse all products")}</Link>
          </div>
        ) : (
          <section aria-labelledby="category-products-heading">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2
                  id="category-products-heading"
                  className="text-xl font-extrabold text-gray-950 [overflow-wrap:anywhere]"
                >
                  {i18n("Products in")}{category.name}
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  {i18n("Includes active descendant categories.")}</p>
              </div>
              <Link
                href={`/products?categoryPath=${encodeURIComponent(category.path)}`}
                className="shrink-0 text-sm font-semibold text-brand-red"
              >
                {i18n("View with filters")}</Link>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
              {category.products.map((product: PublicCategoryProduct) => (
                <div key={product.id} className="min-w-0">
                  <ProductCard
                    id={product.id}
                    productCode={product.productCode}
                    slug={product.slug}
                    name={product.name}
                    price={product.discountPrice ?? product.price}
                    originalPrice={
                      product.discountPrice !== null ? product.price : undefined
                    }
                    image={product.image ?? FALLBACK_PRODUCT_IMAGE}
                    variantCount={product.variantCount}
                    inStock={product.inStock}
                    rating={product.rating}
                    reviewCount={product.reviewCount}
                  />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
