
import { getInterfaceTranslations } from "@/components/i18n/server";
import type { Metadata } from "next";
import { ExternalLink, PackageSearch } from "lucide-react";
import Image from "next/image";
import Link from "@/lib/i18n/navigation";
import { notFound, permanentRedirect } from "next/navigation";

import { cache } from "react";
import { getRequestLocale } from "@/lib/i18n/server";
import { localizeBrandSnapshots } from "@/lib/translations/public";
import PublicContentNotice from "@/components/i18n/PublicContentNotice";

import ProductCard from "@/components/product/ProductCard";
import JsonLd from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, collectionPageJsonLd } from "@/lib/seo/json-ld";
import { noIndexMetadata } from "@/lib/seo/metadata";
import { buildLocalizedMetadata } from "@/lib/seo/localized-metadata";
import { getPublishedEntityLocales } from "@/lib/translations/service";
import { getTranslations } from "next-intl/server";
import { siteConfig } from "@/lib/seo/site";
import {
  getPublicBrandBySlug,
  getPublicBrands,
  getBrandRedirectBySlug,
  type PublicBrandProduct,
} from "@/lib/services/brand.service";

export const revalidate = 1800;
export const dynamicParams = true;

const PRODUCT_FALLBACK_IMAGE = "/logo/wordmark.svg";
const BRAND_STATIC_PARAM_LIMIT = 100;
const getBrandPageData = cache(async(slug:string)=>{const brand=await getPublicBrandBySlug(slug);return brand?(await localizeBrandSnapshots([brand],await getRequestLocale()))[0]:null;});

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const brands = await getPublicBrands();
  return [...brands]
    .sort((left, right) => right.productCount - left.productCount)
    .slice(0, BRAND_STATIC_PARAM_LIMIT)
    .map((brand) => ({ slug: brand.slug }));
}

function brandDescription(brand: {
  name: string;
  description: string | null;
  metaDescription: string | null;
  productCount: number;
}, fallback?: string) {
  return (
    brand.metaDescription?.trim() ||
    brand.description?.trim() ||
    fallback || `Shop ${brand.productCount} available ${brand.name} product${brand.productCount === 1 ? "" : "s"} at ${siteConfig.name}.`
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const translate = await getTranslations("Seo");
  const { slug } = await params;
  const brand = await getBrandPageData(slug);

  if (!brand) {
    const redirectRecord = await getBrandRedirectBySlug(slug);
    if (redirectRecord) permanentRedirect(redirectRecord.destinationPath);
    return noIndexMetadata(
      "Brand unavailable",
      "This brand is unavailable or no longer published.",
    );
  }
  if (slug !== brand.slug) permanentRedirect(`/brands/${brand.slug}`);

  const readyLocales = await getPublishedEntityLocales("brand", [brand.id], ["description", "seoTitle", "metaDescription"]);
  return buildLocalizedMetadata({
    title: brand.seoTitle?.trim() || translate("brandTitle", { brand: brand.name }),
    description: brandDescription(brand, translate("brandDescription", { count: brand.productCount, brand: brand.name, site: siteConfig.name })),
    path: `/brands/${brand.slug}`,
    image: brand.ogImage?.trim() || brand.logo,
    keywords: [brand.name, `${brand.name} products`, `buy ${brand.name}`],
    preparedLocales: readyLocales.get(brand.id) ?? [],
    index: brand.translationAvailable,
  }, "InterfaceBrandsSlugPage");
}

export default async function BrandPage({ params }: Props) {
  const locale = await getRequestLocale();
  const translate = await getTranslations("Seo");
  const i18n = await getInterfaceTranslations("InterfaceBrandsSlugPage");
  const { slug } = await params;
  const brand = await getBrandPageData(slug);
  if (!brand) {
    const redirectRecord = await getBrandRedirectBySlug(slug);
    if (redirectRecord) permanentRedirect(redirectRecord.destinationPath);
    notFound();
  }
  if (slug !== brand.slug) permanentRedirect(`/brands/${brand.slug}`);

  const path = `/brands/${brand.slug}`;
  const description = brandDescription(brand, translate("brandDescription", { count: brand.productCount, brand: brand.name, site: siteConfig.name }));
  const schemas = [
    collectionPageJsonLd({
      name: brand.name,
      description,
      path,
      locale,
    }),
    breadcrumbJsonLd([
      { name: i18n("Home"), path: "/" },
      { name: i18n("Brands"), path: "/brands" },
      { name: brand.name, path },
    ], locale),
  ];

  return (
    <main className="min-h-screen bg-background">
      <JsonLd data={schemas} />
      <div className="mx-auto max-w-7xl px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
        <PublicContentNotice available={brand.translationAvailable}/>
        <nav aria-label={i18n("Breadcrumb")} className="mb-5 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-primary">
            {i18n("Home")}</Link>
          <span aria-hidden className="mx-2">
            /
          </span>
          <Link href="/brands" className="hover:text-primary">
            {i18n("Brands")}</Link>
          <span aria-hidden className="mx-2">
            /
          </span>
          <span aria-current="page" className="font-medium text-foreground">
            {brand.name}
          </span>
        </nav>

        <header className="mb-8 rounded-2xl border border-border bg-card p-6 shadow-sm sm:flex sm:items-center sm:gap-6 lg:p-8">
          <div className="mb-5 flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-background sm:mb-0">
            {brand.logo ? (
              <Image
                src={brand.logo}
                alt={i18n("{value0} logo", { value0: brand.name })}
                width={96}
                height={96}
                preload
                className="h-full w-full object-contain p-2"
              />
            ) : (
              <span className="text-4xl font-bold text-primary" aria-hidden>
                {brand.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-primary">
              {i18n("Brand collection")}</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {brand.name}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-body sm:text-base">
              {i18n(description)}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
              <span className="font-semibold text-body">
                {brand.productCount}{" "}
                {brand.productCount === 1 ? i18n("available product") : i18n("available products")}
              </span>
              {brand.website && (
                <a
                  href={brand.website}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-center gap-1 font-semibold text-primary hover:text-primary-hover"
                >
                  {i18n("Official website")}<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              )}
            </div>
          </div>
        </header>

        {brand.products.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
            <PackageSearch className="mx-auto h-10 w-10 text-primary/70" />
            <h2 className="mt-3 text-lg font-bold text-foreground">
              {i18n("No available products yet")}</h2>
            <p className="mt-2 text-sm text-body">
              {i18n("This brand does not have any active products right now.")}</p>
            <Link
              href="/products"
              className="mt-5 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
            >
              {i18n("Browse all products")}</Link>
          </div>
        ) : (
          <section aria-labelledby="brand-products-heading">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2
                  id="brand-products-heading"
                  className="text-xl font-bold text-foreground"
                >
                  {brand.name} {i18n("products")}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {i18n("Active products from visible categories.")}</p>
              </div>
              {brand.productCount > brand.products.length && (
                <Link
                  href={`/products?brandSlug=${encodeURIComponent(brand.slug)}`}
                  className="text-sm font-semibold text-primary hover:text-primary-hover"
                >
                  {i18n("View all")}{brand.productCount}
                </Link>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
              {brand.products.map((product: PublicBrandProduct) => (
                <ProductCard
                  key={product.id}
                  id={product.id}
                  productCode={product.productCode}
                  slug={product.slug}
                  name={product.name}
                  price={product.discountPrice ?? product.price}
                  originalPrice={
                    product.discountPrice !== null ? product.price : undefined
                  }
                  image={product.image ?? PRODUCT_FALLBACK_IMAGE}
                  variantCount={product.variantCount}
                  inStock={product.inStock}
                  rating={product.rating}
                  reviewCount={product.reviewCount}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
