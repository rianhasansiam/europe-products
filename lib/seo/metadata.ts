import type { Metadata } from "next";

import { DEFAULT_LOCALE, isPublishedLocale } from "@/lib/i18n/registry";
import { localizeHref } from "@/lib/i18n/paths";

import { absoluteUrl, siteConfig } from "./site";

/**
 * Reusable Metadata builders for the SexToy storefront.
 *
 * These keep page/route files thin and ensure every public page emits a
 * consistent, production-ready set of title/description/canonical/Open
 * Graph/Twitter tags. `metadataBase` is set once in the root layout, so
 * relative image/canonical paths resolve to absolute URLs automatically.
 */

/** Convert admin-authored rich/free-form text into safe metadata text. */
export function plainMetadataText(input: string | null | undefined): string {
  return (input ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[<>]/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Truncate free-form text to a search-friendly length on a word boundary. */
export function clampDescription(input: string | null | undefined, max = 160): string {
  const text = plainMetadataText(input);
  if (text.length <= max) return text || siteConfig.description;
  const sliced = text.slice(0, max);
  const lastSpace = sliced.lastIndexOf(" ");
  return `${(lastSpace > 40 ? sliced.slice(0, lastSpace) : sliced).trimEnd()}…`;
}

type OgImageInput = string | null | undefined;

/** Resolve an OG image, falling back to the brand default when missing. */
function resolveOgImages(image: OgImageInput, alt: string) {
  const url = image && image.trim().length > 0 ? image : siteConfig.ogImage;
  return [{ url, alt }];
}

export type PageMetadataInput = {
  title: string;
  description?: string | null;
  /** Site-relative path (e.g. "/products"); used for the canonical URL. */
  path?: string;
  /** Absolute or relative image URL for Open Graph / Twitter. */
  image?: OgImageInput;
  keywords?: string[];
  /** Open Graph type — "website" for listings, "article" where relevant. */
  ogType?: "website" | "article";
  /** Set false for pages that must not be indexed. */
  index?: boolean;
  /** Active URL locale; English is used for legacy callers. */
  locale?: string;
  /** Only variants with translated primary content and metadata belong here. */
  preparedLocales?: readonly string[];
  /** Pass request-resolved publication state when administrator overrides exist. */
  publishedLocales?: readonly string[];
};

/** Reciprocal alternates are emitted only for genuinely prepared variants. */
export function localizedAlternates(path: string, preparedLocales: readonly string[], publishedLocales?: readonly string[]) {
  const locales = Array.from(new Set(preparedLocales))
    .filter((locale) => publishedLocales ? publishedLocales.includes(locale) : isPublishedLocale(locale));
  return Object.fromEntries([
    ...locales.map((locale) => [locale, absoluteUrl(localizeHref(path, locale))]),
    ...(locales.includes(DEFAULT_LOCALE)
      ? [["x-default", absoluteUrl(localizeHref(path, DEFAULT_LOCALE))]]
      : []),
  ]);
}

/**
 * Build a complete `Metadata` object for a public page.
 *
 * Pass a site-relative `path` to get a canonical URL plus matching
 * Open Graph `url`. Images fall back to the brand default so a social
 * card always renders.
 */
export function buildMetadata({
  title,
  description,
  path = "/",
  image,
  keywords,
  ogType = "website",
  index = true,
  locale = DEFAULT_LOCALE,
  preparedLocales = [DEFAULT_LOCALE],
  publishedLocales,
}: PageMetadataInput): Metadata {
  const safeTitle = plainMetadataText(title) || siteConfig.name;
  const desc = clampDescription(description);
  const canonical = absoluteUrl(localizeHref(path, locale));
  const ready = preparedLocales.includes(locale);
  const published = publishedLocales ? publishedLocales.includes(locale) : isPublishedLocale(locale);
  const mayIndex = index && ready && published;
  const images = resolveOgImages(image, safeTitle);

  return {
    title: safeTitle,
    description: desc,
    keywords: keywords && keywords.length > 0 ? keywords : [...siteConfig.keywords],
    alternates: {
      canonical,
      languages: localizedAlternates(path, preparedLocales, publishedLocales),
    },
    openGraph: {
      type: ogType,
      url: canonical,
      siteName: siteConfig.name,
      title: safeTitle,
      description: desc,
      locale: locale.replace(/-/g, "_"),
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: safeTitle,
      description: desc,
      images: images.map((img) => img.url),
    },
    robots: mayIndex
      ? {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
          },
        }
      : { index: false, follow: false },
  };
}

/** Metadata for private/utility pages that must never be indexed. */
export function noIndexMetadata(title: string, description?: string): Metadata {
  return {
    title,
    description: description ?? siteConfig.description,
    // Metadata merges shallowly. Explicitly replace the root homepage
    // canonical so private routes never claim `/` as their canonical URL.
    alternates: { canonical: null },
    openGraph: null,
    twitter: null,
    robots: { index: false, follow: false },
  };
}
