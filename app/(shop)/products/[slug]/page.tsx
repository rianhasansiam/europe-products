
import { useInterfaceTranslations } from "@/components/i18n/translate";
import { getInterfaceTranslations } from "@/components/i18n/server";
import type { Metadata } from "next";
import Link from "@/lib/i18n/navigation";
import { notFound, permanentRedirect } from "next/navigation";

import { cache } from "react";

import {
  getActiveDealBanners,
  getActivePromoBanners,
} from "@/lib/services/banner.service";
import {
  getActiveProductBySlug,
  getProductRedirectBySlug,
  getProductSlugById,
  listProducts,
  type ProductWithCategory,
} from "@/lib/services/product.service";
import { cleanVariantAttributes } from "@/lib/catalog/variant-options";
import { dependOnCatalogTags } from "@/lib/cache/catalog-dependency";
import { productDetailCacheTags } from "@/lib/cache/product-detail-dependencies";
import JsonLd from "@/components/seo/JsonLd";
import ProductView from "@/components/analytics/ProductView";
import {
  productFallbackDescription,
  productFallbackTitle,
  type CatalogMetadataTranslator,
} from "@/lib/seo/catalog-metadata";
import {
  clampDescription,
  noIndexMetadata,
  plainMetadataText,
} from "@/lib/seo/metadata";
import {
  breadcrumbJsonLd,
  productGroupJsonLd,
  productJsonLd,
} from "@/lib/seo/json-ld";
import { absoluteUrl, siteConfig } from "@/lib/seo/site";
import { getRequestCurrencyContext } from "@/lib/currency/request-currency";

import Breadcrumbs from "./components/Breadcrumbs";
import {
  DeferredDealsCarousel,
  DeferredRelatedProducts,
  DeferredReviewSection,
} from "./components/DeferredProductSections";

import ProductActions from "./components/ProductActions";
import ProductGallery from "./components/ProductGallery";
import ProductInfo from "./components/ProductInfo";
import ProductTabs from "./components/ProductTabs";
import ProductDescriptionRenderer from "@/components/product/product-description/ProductDescriptionRenderer";
import PromoBanners from "./components/PromoBanners";
import RecentProducts from "./components/RecentProducts";
import { initialVariantSelectionId } from "./components/variant-selection";
import CurrencyAmount from "@/components/currency/CurrencyAmount";
import { localizeProductDetail, localizeProductSnapshots } from "@/lib/translations/public";
import { getRequestLocale } from "@/lib/i18n/server";
import PublicContentNotice from "@/components/i18n/PublicContentNotice";
import { buildLocalizedMetadata } from "@/lib/seo/localized-metadata";
import { getPublishedEntityLocales } from "@/lib/translations/service";
import { localizeHref } from "@/lib/i18n/paths";
import { getTranslations } from "next-intl/server";

export const revalidate = 900;
export const dynamicParams = true;

const FALLBACK_PRODUCT_IMAGE =
  "https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200&h=630&fit=crop";
const PRODUCT_STATIC_PARAM_LIMIT = 100;

const getProductPageData = cache(async (slug:string)=>localizeProductDetail(await getActiveProductBySlug(slug)));

type Props = {
  params: Promise<{ slug: string }>;
};

type ProductImage = ProductWithCategory["images"][number];
type ProductVariant = ProductWithCategory["variants"][number];

export async function generateStaticParams() {
  const { items } = await listProducts({
    page: 1,
    pageSize: PRODUCT_STATIC_PARAM_LIMIT,
    status: "ACTIVE",
    sort: "popular",
  });

  return items.map((product) => ({ slug: product.slug }));
}

/** Resolve effective customer price (discount when valid) from the product. */
function effectivePrice(product: {
  salePrice: { toNumber(): number };
  discountPrice: { toNumber(): number } | null;
}) {
  const sale = product.salePrice.toNumber();
  const discount = product.discountPrice?.toNumber() ?? null;
  return discount != null && discount < sale ? discount : sale;
}

/** Regular sale price (before discount) from the product. */
function listPrice(product: { salePrice: { toNumber(): number } }) {
  return product.salePrice.toNumber();
}

function discountPercent(price: number, originalPrice: number) {
  if (originalPrice <= 0 || originalPrice <= price) return 0;
  return Math.round(((originalPrice - price) / originalPrice) * 100);
}

function productShortDescription(product: ProductWithCategory, price: number | undefined, locale = "en", translator?: CatalogMetadataTranslator) {
  return productFallbackDescription({
    name: product.name,
    productCode: product.productCode,
    description: product.description,
    categoryName: product.category.name,
    price,
  }, locale, translator);
}

function productImageUrlsForSeo(
  productImageUrls: string[],
  variantGalleryImages: { url: string }[],
) {
  const images =
    productImageUrls.length > 0
      ? productImageUrls
      : variantGalleryImages.length > 0
        ? variantGalleryImages.map((item) => item.url)
        : [FALLBACK_PRODUCT_IMAGE];

  return Array.from(
    new Set(
      images
        .map((src) => src.trim())
        .filter((src) => src.length > 0)
        .map((src) => absoluteUrl(src)),
    ),
  );
}

function productIsInStock(product: ProductWithCategory) {
  return product.variants.some(
    (variant) => variant.isActive && variant.stock > 0,
  );
}

function productStockCount(product: ProductWithCategory) {
  return product.variants
    .filter((variant) => variant.isActive)
    .reduce((sum, variant) => sum + variant.stock, 0);
}

function productConditionLabel(
  condition: ProductWithCategory["itemCondition"],
) {
  return {
    NEW: "new",
    REFURBISHED: "refurbished",
    USED: "used",
  }[condition];
}

function variantImageLabel(variant: ProductVariant) {
  const attributes = cleanVariantAttributes(variant.attributes);
  const parts = [
    variant.name,
    ...Object.values(attributes ?? {}),
    variant.color,
    variant.size,
  ].filter(
    (value): value is string =>
      typeof value === "string" && value.trim().length > 0,
  );
  return parts.length > 0
    ? Array.from(new Set(parts)).join(" / ")
    : (variant.sku ?? undefined);
}

function productVariantAxes(variants: ProductVariant[]): string[] {
  const axes: string[] = [];
  const colors = new Set(
    variants.map((variant) => variant.color?.trim()).filter(Boolean),
  );
  const sizes = new Set(
    variants.map((variant) => variant.size?.trim()).filter(Boolean),
  );
  if (colors.size > 1) axes.push("https://schema.org/color");
  if (sizes.size > 1) axes.push("https://schema.org/size");

  const valuesByAttribute = new Map<string, Set<string>>();
  for (const variant of variants) {
    for (const [key, value] of Object.entries(
      cleanVariantAttributes(variant.attributes) ?? {},
    )) {
      const values = valuesByAttribute.get(key) ?? new Set<string>();
      values.add(value);
      valuesByAttribute.set(key, values);
    }
  }
  for (const [key, values] of valuesByAttribute) {
    if (values.size > 1 && !["color", "size"].includes(key.toLowerCase())) {
      axes.push(key);
    }
  }
  return axes.length > 0 ? axes : ["Variant"];
}

function productReviewMetrics(product: ProductWithCategory) {
  const reviewCount = product.reviews.length;
  const rating =
    reviewCount > 0
      ? product.reviews.reduce((total, review) => total + review.rating, 0) /
        reviewCount
      : 0;
  return { rating, reviewCount };
}

function productSpecifications(
  product: ProductWithCategory,
): Record<string, string | number | boolean> | null {
  if (
    !product.specifications ||
    typeof product.specifications !== "object" ||
    Array.isArray(product.specifications)
  ) {
    return null;
  }

  const entries = Object.entries(product.specifications).filter(
    (entry): entry is [string, string | number | boolean] =>
      typeof entry[1] === "string" ||
      typeof entry[1] === "number" ||
      typeof entry[1] === "boolean",
  );
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

function ProductCrawlerFacts({
  name,
  description,
  category,
  categoryHref,
  brand,
  manufacturer,
  productUrl,
  imageUrls,
  regularPrice,
  currentPrice,
  hasDiscount,
  stockCount,
  availabilityLabel,
}: {
  name: string;
  description: string;
  category: string;
  categoryHref: string;
  brand: string | null;
  manufacturer: string | null;
  productUrl: string;
  imageUrls: string[];
  regularPrice: number;
  currentPrice: number;
  hasDiscount: boolean;
  stockCount: number;
  availabilityLabel: string;
}) {
  const i18n = useInterfaceTranslations("InterfaceProductsSlugPage");
  return (
    <section className="sr-only" aria-label={i18n("{value0} product summary", { value0: name })}>
      <h2>{name}</h2>
      <p>{i18n(description)}</p>
      {brand && <p>{i18n("Brand:")}{brand}</p>}
      {manufacturer && <p>{i18n("Manufacturer:")}{manufacturer}</p>}
      <p>
        {i18n("Category:")}<Link href={categoryHref}>{category}</Link>
      </p>
      <p>
        {i18n("Current price:")}<CurrencyAmount amountUSD={currentPrice} />
      </p>
      <p>
        {i18n("Regular price:")}<CurrencyAmount amountUSD={regularPrice} />
      </p>
      {hasDiscount && (
        <p>
          {i18n("Discounted price:")}<CurrencyAmount amountUSD={currentPrice} />
        </p>
      )}
      <p>{i18n("Availability:")}{availabilityLabel}</p>
      <p>{i18n("Stock available:")}{stockCount}</p>
      <p>
        {i18n("Product URL:")}<a href={productUrl}>{productUrl}</a>
      </p>
      <ul>
        {imageUrls.map((url, index) => (
          <li key={url}>
            {i18n("Product image")}{index + 1}: <a href={url}>{url}</a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await getRequestLocale();
  const translate = await getTranslations("Seo");
  const { slug } = await params;
  // Only ACTIVE products get rich, indexable metadata. Inactive or
  // missing products are marked noindex so they never surface in search.
  const product = await getProductPageData(slug);

  if (!product) {
    const redirectRecord = await getProductRedirectBySlug(slug);
    if (redirectRecord) permanentRedirect(redirectRecord.destinationPath);

    const canonicalSlug = await getProductSlugById(slug);
    if (canonicalSlug && canonicalSlug !== slug) {
      permanentRedirect(`/products/${canonicalSlug}`);
    }
    return noIndexMetadata(
      "Product unavailable",
      "This product is unavailable or no longer published.",
    );
  }
  if (slug !== product.slug) permanentRedirect(`/products/${product.slug}`);

  const price = effectivePrice(product);
  const { pricingReady } = await getRequestCurrencyContext();
  const regularPrice = listPrice(product);
  const hasDiscount = price < regularPrice;
  const description = clampDescription(
    product.metaDescription || productShortDescription(product, pricingReady ? price : undefined, locale, translate),
  );
  const canonical = absoluteUrl(localizeHref(`/products/${product.slug}`, locale));
  const imageUrl = absoluteUrl(
    product.ogImage?.trim() || product.images[0]?.url || FALLBACK_PRODUCT_IMAGE,
  );
  const availability = productIsInStock(product) ? "in stock" : "out of stock";
  const title =
    plainMetadataText(product.seoTitle) ||
    productFallbackTitle({
      name: product.name,
      productCode: product.productCode,
    });
  const brandName = product.brand?.name ?? null;
  const manufacturerName = product.manufacturer?.name ?? null;
  const readyLocales = await getPublishedEntityLocales("product", [product.id], ["name", "description", "descriptionBlocks", "seoTitle", "metaDescription"]);
  const localizedMetadata = await buildLocalizedMetadata({
    title, description, path: `/products/${product.slug}`,
    preparedLocales: readyLocales.get(product.id) ?? [],
    index: product.translationAvailable,
  }, "InterfaceProductsSlugPage");

  return {
    title: { absolute: title },
    description,
    keywords: [
      product.name,
      product.category.name,
      brandName,
      manufacturerName,
      product.modelNumber,
      product.series,
      siteConfig.name,
      "buy online",
      "online shopping",
      siteConfig.currency,
    ].filter((keyword): keyword is string => Boolean(keyword)),
    alternates: localizedMetadata.alternates,
    openGraph: {
      url: canonical,
      siteName: siteConfig.name,
      title,
      description,
      locale: locale.replace(/-/g, "_"),
      images: [
        {
          url: imageUrl,
          secureUrl: imageUrl,
          alt: product.name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
    category: product.category.name,
    other: {
      ...(brandName ? { "product:brand": brandName } : {}),
      "og:type": "product",
      "product:category": product.category.name,
      "product:retailer_item_id": product.productCode,
      "product:condition": productConditionLabel(product.itemCondition),
      "product:availability": availability,
      ...(pricingReady ? {
        "product:price:amount": regularPrice.toFixed(2),
        "product:price:currency": siteConfig.currency,
        "og:price:amount": price.toFixed(2),
        "og:price:currency": siteConfig.currency,
      } : {}),
      ...(pricingReady && hasDiscount
        ? {
            "product:sale_price:amount": price.toFixed(2),
            "product:sale_price:currency": siteConfig.currency,
          }
        : {}),
    },
    robots: localizedMetadata.robots,
  };
}

export default async function ProductDetailsPage({ params }: Props) {
  const { pricingReady } = await getRequestCurrencyContext();
  const locale = await getRequestLocale();
  const translate = await getTranslations("Seo");
  const i18n = await getInterfaceTranslations("InterfaceProductsSlugPage");
  const { slug } = await params;
  const product = await getProductPageData(slug);

  // Backward compatibility: older links (cart, wishlist, orders, shared
  // URLs) reference a product by its cuid id. If the slug lookup misses,
  // first honor a recorded slug change, then try treating the param as an
  // id. Both paths 308-redirect to the current canonical product URL.
  if (!product) {
    const redirectRecord = await getProductRedirectBySlug(slug);
    if (redirectRecord) permanentRedirect(redirectRecord.destinationPath);

    const canonicalSlug = await getProductSlugById(slug);
    if (canonicalSlug && canonicalSlug !== slug) {
      permanentRedirect(`/products/${canonicalSlug}`);
    }
    notFound();
  }
  if (slug !== product.slug) {
    permanentRedirect(`/products/${product.slug}`);
  }

  // Pull a generous batch from the same canonical category subtree so we can split it into
  // recent + related without hitting the DB twice. Banners come from
  // their own cached services so a marketing change shows up here on the
  // next request without a full deploy.
  const [{ items: relatedRows }, dealBanners, promoBanners] = await Promise.all(
    [
      listProducts({
        page: 1,
        pageSize: 24,
        categoryPath: product.category.path,
        status: "ACTIVE",
        sort: "latest",
      }),
      getActiveDealBanners(),
      getActivePromoBanners(),
    ],
  );

  const others = (await localizeProductSnapshots(relatedRows,await getRequestLocale())).filter(
    (row: ProductWithCategory) => row.id !== product.id,
  );

  const toCard = (row: (typeof others)[number]) => {
    const cardPrice = effectivePrice(row);
    const cardOriginal = listPrice(row);
    return {
      id: row.id,
      productCode: row.productCode,
      variantCount: row.variants.filter((variant) => variant.isActive).length,
      inStock: productIsInStock(row),
      slug: row.slug,
      name: row.name,
      image: row.images[0]?.url ?? FALLBACK_PRODUCT_IMAGE,
      price: cardPrice,
      originalPrice: cardOriginal,
      discount: discountPercent(cardPrice, cardOriginal),
    };
  };

  const recentProducts = others.slice(0, 6).map(toCard);
  const relatedProducts = others.slice(0, 16).map(toCard);

  const productImages = product.images.map((img: ProductImage) => ({
    url: img.url,
    alt: img.alt,
  }));
  const productImageUrls = productImages.map((image) => image.url);

  const activeVariants = product.variants.filter(
    (variant: ProductVariant) => variant.isActive,
  );
  const variantGalleryImages = activeVariants
    .map((variant: ProductVariant) => ({
      variantId: variant.id,
      url: variant.image,
      label: variantImageLabel(variant),
    }))
    .filter(
      (
        item,
      ): item is {
        variantId: string;
        url: string;
        label: string | undefined;
      } => typeof item.url === "string" && item.url.trim().length > 0,
    );
  const currentPrice = effectivePrice(product);
  const regularPrice = listPrice(product);
  const hasDiscount = currentPrice < regularPrice;
  const inStock = productIsInStock(product);
  const stockCount = productStockCount(product);
  const availabilityLabel = inStock ? "in stock" : "out of stock";
  const shortDescription = productShortDescription(product, pricingReady ? currentPrice : undefined, locale, translate);
  const productUrl = absoluteUrl(`/products/${product.slug}`);
  const seoImageUrls = productImageUrlsForSeo(
    productImageUrls,
    variantGalleryImages,
  );
  const primaryDisplayImage =
    productImageUrls[0] ??
    variantGalleryImages[0]?.url ??
    FALLBACK_PRODUCT_IMAGE;
  const initialVariantId = initialVariantSelectionId(product.variants);
  const categoryPath = product.category.path || product.category.slug;
  const categoryBreadcrumb =
    product.categoryBreadcrumb.length > 0
      ? product.categoryBreadcrumb
      : [
          {
            id: product.category.id,
            name: product.category.name,
            slug: product.category.slug,
            path: categoryPath,
          },
        ];
  const categoryLabel = categoryBreadcrumb.map((item) => item.name).join(" › ");
  const breadcrumbItems = [
    { label: i18n("Products"), href: "/products" },
    ...categoryBreadcrumb.map((item) => ({
      label: item.name,
      href: `/categories/${item.path}`,
    })),
    { label: product.name },
  ];
  const specifications = productSpecifications(product);
  const { rating, reviewCount } = productReviewMetrics(product);
  const brandName = product.brand?.name ?? null;
  const manufacturerName = product.manufacturer?.name ?? null;

  await dependOnCatalogTags(
    productDetailCacheTags({
      product,
      category: product.category,
      categoryBreadcrumb,
      relatedProducts: others,
      brand: product.brand,
      manufacturerId: product.manufacturer?.id,
    }),
  );

  // Structured data: only emit for publicly visible (ACTIVE) products so
  // crawlers never see schema for hidden/soft-deleted items. We use the
  // first real variant SKU when present, otherwise the public product code.
  const isPublic = product.status === "ACTIVE";
  const primarySku =
    activeVariants.find((variant: ProductVariant) => variant.sku)?.sku ??
    product.productCode;
  const productSchema = isPublic
    ? productJsonLd({
        name: product.name,
        description: shortDescription,
        images: seoImageUrls,
        path: `/products/${product.slug}`,
        locale,
        price: currentPrice,
        pricingReady,
        inStock,
        category: categoryLabel,
        sku: primarySku,
        brand: brandName,
        gtin: product.gtin,
        manufacturer: manufacturerName,
        itemCondition: product.itemCondition,
        rating:
          reviewCount > 0 ? { average: rating, count: reviewCount } : undefined,
      })
    : null;
  const productGroupSchema =
    isPublic && activeVariants.length > 1
      ? productGroupJsonLd({
          productGroupId: product.productCode,
          name: product.name,
          description: shortDescription,
          images: seoImageUrls,
          path: `/products/${product.slug}`,
          locale,
          price: currentPrice,
          pricingReady,
          category: categoryLabel,
          brand: brandName,
          gtin: product.gtin,
          manufacturer: manufacturerName,
          itemCondition: product.itemCondition,
          rating:
            reviewCount > 0
              ? { average: rating, count: reviewCount }
              : undefined,
          variesBy: productVariantAxes(activeVariants),
          variants: activeVariants.map((variant, index) => {
            const label = variantImageLabel(variant) || `Option ${index + 1}`;
            return {
              name: `${product.name} - ${label}`,
              sku: variant.sku,
              image: variant.image || primaryDisplayImage,
              color: variant.color,
              size: variant.size,
              attributes: cleanVariantAttributes(variant.attributes),
              inStock: variant.stock > 0,
            };
          }),
        })
      : null;
  const breadcrumbSchema = isPublic
    ? breadcrumbJsonLd([
        { name: i18n("Home"), path: "/" },
        { name: i18n("Products"), path: "/products" },
        ...categoryBreadcrumb.map((item) => ({
          name: item.name,
          path: `/categories/${item.path}`,
        })),
        { name: product.name, path: `/products/${product.slug}` },
      ], locale)
    : null;

  return (
    <main className="min-h-screen bg-background pb-[calc(3.75rem+env(safe-area-inset-bottom))] lg:pb-0">
      {pricingReady && <ProductView item={{
        productId: product.id,
        productCode: product.productCode,
        name: product.name,
        quantity: 1,
        unitPrice: currentPrice,
      }} />}
      {productSchema && breadcrumbSchema && (
        <JsonLd
          data={
            productGroupSchema
              ? [productSchema, productGroupSchema, breadcrumbSchema]
              : [productSchema, breadcrumbSchema]
          }
        />
      )}
      <div className="max-w-7xl mx-auto px-3 py-6 sm:px-4 lg:px-6">
        <PublicContentNotice available={product.translationAvailable}/>
        <Breadcrumbs items={breadcrumbItems} />

        <ProductCrawlerFacts
          name={product.name}
          description={shortDescription}
          category={categoryLabel}
          categoryHref={`/categories/${categoryPath}`}
          brand={brandName}
          manufacturer={manufacturerName}
          productUrl={productUrl}
          imageUrls={seoImageUrls}
          regularPrice={regularPrice}
          currentPrice={currentPrice}
          hasDiscount={hasDiscount}
          stockCount={stockCount}
          availabilityLabel={availabilityLabel}
        />

        {/* <nav
          aria-label="Product shopping links"
          className="mt-4 flex flex-wrap gap-2 text-xs font-semibold"
        >
          <Link
            href="/products"
            className="rounded-full border border-border bg-card px-3 py-1.5 text-body transition hover:border-primary hover:text-primary"
          >
            Shop All
          </Link>
          <Link
            href="/products?sort=latest"
            className="rounded-full border border-border bg-card px-3 py-1.5 text-body transition hover:border-primary hover:text-primary"
          >
            New Arrivals
          </Link>
          <Link
            href={`/categories/${categoryPath}`}
            className="max-w-full rounded-full border border-border bg-card px-3 py-1.5 text-body transition [overflow-wrap:anywhere] hover:border-primary hover:text-primary"
          >
            {product.category.name}
          </Link>
          <Link
            href="/contact"
            className="rounded-full border border-border bg-card px-3 py-1.5 text-body transition hover:border-primary hover:text-primary"
          >
            Contact Us
          </Link>
        </nav> */}

        <div className="mt-6 grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="min-w-0 md:col-span-6 lg:col-span-4">
            <ProductGallery
              productId={product.id}
              images={productImages}
              variantImages={variantGalleryImages}
              initialVariantId={initialVariantId}
              productName={product.name}
            />
          </div>

          <div className="min-w-0 md:col-span-6 lg:col-span-5">
            <div className="min-w-0 rounded-2xl border border-border bg-card p-4 sm:p-6">
              <ProductInfo
                name={product.name}
                nameLocale={product.fieldLocales.name}
                productCode={product.productCode}
                modelNumber={product.modelNumber}
                gtin={product.gtin}
                condition={productConditionLabel(product.itemCondition)}
                series={product.series}
                brand={product.brand}
                manufacturer={product.manufacturer}
                rating={rating}
                reviewCount={reviewCount}
              />

              <ProductActions
                key={product.id}
                productId={product.id}
                productCode={product.productCode}
                productSlug={product.slug}
                productName={product.name}
                image={primaryDisplayImage}
                brand={brandName}
                category={categoryLabel}
                rating={rating}
                reviewCount={reviewCount}
                salePrice={product.salePrice.toNumber()}
                discountPrice={
                  product.discountPrice != null
                    ? product.discountPrice.toNumber()
                    : null
                }
                variants={product.variants.map((v: ProductVariant) => ({
                  id: v.id,
                  variantKey: v.variantKey,
                  name: v.name,
                  modelNumber: v.modelNumber,
                  sku: v.sku,
                  color: v.color,
                  size: v.size,
                  attributes: cleanVariantAttributes(v.attributes),
                  stock: v.stock,
                  image: v.image,
                  isActive: v.isActive,
                }))}
              />
            </div>
          </div>

          <div className="min-w-0 md:col-span-12 lg:col-span-3">
            <RecentProducts products={recentProducts} title={i18n("Recent Product")} />
          </div>
        </div>

        {/* Block-based description (primary) */}
        {(() => {
          const hasBlocks = Array.isArray(product.descriptionBlocks) &&
            (product.descriptionBlocks as unknown[]).length > 0;
          const hasLegacyTabs = product.description?.trim() || specifications;

          return (
            <>
              {hasBlocks && (
                <div className="mt-10" lang={product.fieldLocales.descriptionBlocks} dir="auto">
                  <h2 className="sr-only">{i18n("Product description")}</h2>
                  <ProductDescriptionRenderer
                    blocks={product.descriptionBlocks}
                    legacyDescription={product.description}
                  />
                </div>
              )}

              {/* Legacy tabs: always show specs; only show description tab when no block-based content */}
              {(!hasBlocks && hasLegacyTabs || specifications) && (
                <div className="mt-10" lang={product.fieldLocales.description} dir="auto">
                  <ProductTabs
                    description={hasBlocks ? null : product.description}
                    specifications={specifications}
                  />
                </div>
              )}
            </>
          );
        })()}

        <div className="mt-10">
          <DeferredDealsCarousel
            deals={dealBanners}
            title={i18n("Black Friday Deals")}
          />
        </div>

        <div className="mt-10" id="reviews">
          <DeferredReviewSection productId={product.id} />
        </div>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-6 pb-12">
          <div className="min-w-0 lg:col-span-9">
            <DeferredRelatedProducts
              products={relatedProducts}
              title={i18n("More Relevant Products")}
            />
          </div>

          <div className="min-w-0 lg:col-span-3">
            <PromoBanners banners={promoBanners} />
          </div>
        </div>
      </div>
    </main>
  );
}
