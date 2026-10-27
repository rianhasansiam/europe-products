import { absoluteUrl, siteConfig, socialProfiles } from "./site";
import { localizeHref } from "@/lib/i18n/paths";
import { DEFAULT_LOCALE } from "@/lib/i18n/registry";

function contentUrl(path: string, locale?: string) {
  return absoluteUrl(localizeHref(path, locale ?? DEFAULT_LOCALE));
}

/**
 * Strongly-typed-ish JSON-LD builders for SexToy.
 *
 * Each helper returns a plain object ready to be serialized into a
 * `<script type="application/ld+json">` tag. We never invent data:
 * SKU, ratings, etc. are only included when a real value is
 * passed in. Keys with `undefined` values are stripped before render.
 */

export type JsonLd = Record<string, unknown>;

type ProductCondition = "NEW" | "REFURBISHED" | "USED";

function plainJsonLdText(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/[<>]/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function productConditionUrl(condition: ProductCondition = "NEW") {
  return {
    NEW: "https://schema.org/NewCondition",
    REFURBISHED: "https://schema.org/RefurbishedCondition",
    USED: "https://schema.org/UsedCondition",
  }[condition];
}

function offerJsonLd(input: {
  url: string;
  price: number;
  currency?: string;
  inStock: boolean;
  itemCondition?: ProductCondition;
}) {
  return prune({
    "@type": "Offer",
    url: input.url,
    priceCurrency: input.currency ?? siteConfig.currency,
    price: Number.isFinite(input.price) ? input.price.toFixed(2) : undefined,
    availability: input.inStock
      ? "https://schema.org/InStock"
      : "https://schema.org/OutOfStock",
    itemCondition: productConditionUrl(input.itemCondition),
    seller: {
      "@type": "Organization",
      name: siteConfig.name,
      url: siteConfig.url,
    },
  });
}

/** Remove `undefined`/`null` values so we never emit empty JSON-LD fields. */
function prune<T extends JsonLd>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined && value !== null),
  ) as T;
}

/** Organization schema for SexToy (use once, app-wide). */
export function organizationJsonLd(description: string = siteConfig.description): JsonLd {
  return prune({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    url: siteConfig.url,
    logo: siteConfig.logo,
    description,
    sameAs: socialProfiles.length > 0 ? socialProfiles : undefined,
  });
}

/**
 * WebSite schema with an optional SearchAction. SexToy's search routes
 * to `/products?search=<query>`, so we wire the SearchAction there.
 */
export function websiteJsonLd(locale?: string, description: string = siteConfig.description): JsonLd {
  return prune({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: contentUrl("/", locale),
    description,
    inLanguage: locale,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${contentUrl("/products", locale)}?search={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  });
}

export type BreadcrumbItem = { name: string; path: string };

/** BreadcrumbList schema from an ordered list of {name, path} items. */
export function breadcrumbJsonLd(items: BreadcrumbItem[], locale?: string): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: contentUrl(item.path, locale),
    })),
  };
}

export type ProductJsonLdInput = {
  name: string;
  description: string;
  /** Image URLs (absolute or site-relative). At least one recommended. */
  images?: string[];
  /** Product detail path, e.g. `/products/<id>`. */
  path: string;
  locale?: string;
  /** Effective selling price (already resolved to sale price when valid). */
  price: number;
  /** False until persisted catalog/settings prices have been reviewed as USD. */
  pricingReady?: boolean;
  currency?: string;
  /** Whether at least one variant is purchasable. */
  inStock: boolean;
  /** Category name, used as a hint only. */
  category?: string | null;
  /** Real SKU if available — omitted entirely when absent. */
  sku?: string | null;
  /** Real manufacturer part number if available; never synthesized. */
  mpn?: string | null;
  /** Real Global Trade Item Number if available; never synthesized. */
  gtin?: string | null;
  /** Persisted product condition. Defaults to NEW for legacy callers. */
  itemCondition?: ProductCondition;
  /** Aggregate backed by persisted reviews; omitted when no reviews exist. */
  rating?: {
    average: number;
    count: number;
  };
};

/**
 * Product schema for a product detail page.
 *
 * Only emits optional catalog and rating fields when real values are passed.
 */
export function productJsonLd(input: ProductJsonLdInput): JsonLd {
  const url = contentUrl(input.path, input.locale);
  const mpn = input.mpn?.trim();
  const gtin = input.gtin?.trim();
  const images = (input.images ?? [])
    .filter((src) => typeof src === "string" && src.length > 0)
    .map((src) => absoluteUrl(src));

  return prune({
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.name,
    description: plainJsonLdText(input.description),
    url,
    image: images.length > 0 ? images : undefined,
    sku: input.sku ?? undefined,
    mpn: mpn || undefined,
    gtin: gtin || undefined,
    category: input.category ?? undefined,
    aggregateRating:
      input.rating &&
      Number.isFinite(input.rating.average) &&
      input.rating.average >= 1 &&
      input.rating.average <= 5 &&
      Number.isInteger(input.rating.count) &&
      input.rating.count > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: Number(input.rating.average.toFixed(2)),
            reviewCount: input.rating.count,
            bestRating: 5,
            worstRating: 1,
          }
        : undefined,
    offers: input.pricingReady === false ? undefined : offerJsonLd({
      url,
      price: input.price,
      currency: input.currency,
      inStock: input.inStock,
      itemCondition: input.itemCondition,
    }),
  });
}

export type ProductGroupVariantJsonLdInput = {
  name: string;
  sku?: string | null;
  mpn?: string | null;
  image?: string | null;
  color?: string | null;
  size?: string | null;
  attributes?: Record<string, string> | null;
  inStock: boolean;
};

export type ProductGroupJsonLdInput = Omit<
  ProductJsonLdInput,
  "sku" | "inStock"
> & {
  productGroupId: string;
  variesBy: string[];
  variants: ProductGroupVariantJsonLdInput[];
};

/** Emit variant markup only for a genuine multi-variant product group. */
export function productGroupJsonLd(input: ProductGroupJsonLdInput): JsonLd {
  const url = contentUrl(input.path, input.locale);
  const images = (input.images ?? [])
    .filter((src) => typeof src === "string" && src.length > 0)
    .map((src) => absoluteUrl(src));
  const aggregateRating =
    input.rating &&
    Number.isFinite(input.rating.average) &&
    input.rating.average >= 1 &&
    input.rating.average <= 5 &&
    Number.isInteger(input.rating.count) &&
    input.rating.count > 0
      ? {
          "@type": "AggregateRating",
          ratingValue: Number(input.rating.average.toFixed(2)),
          reviewCount: input.rating.count,
          bestRating: 5,
          worstRating: 1,
        }
      : undefined;

  return prune({
    "@context": "https://schema.org",
    "@type": "ProductGroup",
    productGroupID: input.productGroupId,
    name: input.name,
    description: plainJsonLdText(input.description),
    url,
    image: images.length > 0 ? images : undefined,
    variesBy: input.variesBy.length > 0 ? input.variesBy : undefined,
    category: input.category ?? undefined,
    mpn: input.mpn?.trim() || undefined,
    gtin: input.gtin?.trim() || undefined,
    aggregateRating,
    hasVariant: input.variants.map((variant) => {
      const attributes = Object.entries(variant.attributes ?? {})
        .filter(([key, value]) => key.trim() && value.trim())
        .map(([name, value]) => ({
          "@type": "PropertyValue",
          name,
          value,
        }));
      return prune({
        "@type": "Product",
        name: variant.name,
        url,
        sku: variant.sku?.trim() || undefined,
        mpn: variant.mpn?.trim() || undefined,
        image: variant.image ? absoluteUrl(variant.image) : undefined,
        color: variant.color?.trim() || undefined,
        size: variant.size?.trim() || undefined,
        additionalProperty: attributes.length > 0 ? attributes : undefined,
        offers: input.pricingReady === false ? undefined : offerJsonLd({
          url,
          price: input.price,
          currency: input.currency,
          inStock: variant.inStock,
          itemCondition: input.itemCondition,
        }),
      });
    }),
  });
}

/** CollectionPage schema for a category landing page. */
export function collectionPageJsonLd(input: {
  name: string;
  description?: string | null;
  path: string;
  locale?: string;
}): JsonLd {
  return prune({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: input.name,
    description: input.description
      ? plainJsonLdText(input.description)
      : undefined,
    url: contentUrl(input.path, input.locale),
    inLanguage: input.locale,
  });
}
