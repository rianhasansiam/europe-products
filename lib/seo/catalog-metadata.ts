import { clampDescription, plainMetadataText } from "@/lib/seo/metadata";
import { siteConfig } from "@/lib/seo/site";
import { createTranslator } from "next-intl";
import englishMessages from "@/messages/seo-en.json";
import bengaliMessages from "@/messages/seo-bn.json";

function messages(locale: string) {
  return createTranslator({ locale, namespace: "Seo", messages: locale === "bn" ? bengaliMessages : englishMessages });
}
export type CatalogMetadataTranslator = ReturnType<typeof messages>;

const SEO_TITLE_MAX_LENGTH = 70;

type CategoryIdentity = {
  name: string;
  path: string;
  breadcrumb?: readonly { name: string }[];
};

function clampTextWithSuffix(
  text: string,
  suffix: string,
  max = SEO_TITLE_MAX_LENGTH,
): string {
  const safeText = plainMetadataText(text);
  if (`${safeText}${suffix}`.length <= max) return `${safeText}${suffix}`;
  const available = Math.max(1, max - suffix.length - 1);
  const sliced = safeText.slice(0, available);
  const lastSpace = sliced.lastIndexOf(" ");
  const prefix = (
    lastSpace > Math.floor(available / 2) ? sliced.slice(0, lastSpace) : sliced
  ).trimEnd();
  return `${prefix}…${suffix}`.slice(0, max);
}

function catalogSlug(input: string): string {
  return (
    input
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "category"
  );
}

function pathFingerprint(path: string): string {
  let hash = 0x811c9dc5;
  for (const character of path) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(7, "0");
}

function categoryDisplayContext(input: CategoryIdentity): {
  context: string;
  qualifier: string;
} {
  const names = [
    ...(input.breadcrumb ?? []).map((item) => plainMetadataText(item.name)),
    plainMetadataText(input.name),
  ].filter(Boolean);
  const actualSegments = input.path.split("/").filter(Boolean);
  const expectedSegments = names.map(catalogSlug);
  const needsPathQualifier =
    actualSegments.length !== expectedSegments.length ||
    actualSegments.some(
      (segment, index) => segment !== expectedSegments[index],
    );

  return {
    context: names.join(" › ") || plainMetadataText(input.name),
    qualifier: needsPathQualifier ? ` [${input.path}]` : "",
  };
}

export function categoryFallbackTitle(input: CategoryIdentity, locale = "en", translator?: CatalogMetadataTranslator): string {
  const translate = translator ?? messages(locale);
  const { context, qualifier } = categoryDisplayContext(input);
  const naturalTitle = translate("categoryTitle", { context, qualifier });
  if (naturalTitle.length <= SEO_TITLE_MAX_LENGTH) return naturalTitle;

  return clampTextWithSuffix(
    translate("categoryTitleShort", { context }),
    translate("categoryTitleSuffix", { fingerprint: pathFingerprint(input.path) }),
  );
}

export function categoryFallbackDescription(
  input: CategoryIdentity & {
    description?: string | null;
    totalProductCount: number;
  },
  locale = "en",
  translator?: CatalogMetadataTranslator,
): string {
  const translate = translator ?? messages(locale);
  const { context, qualifier } = categoryDisplayContext(input);
  const naturalIdentity = `${context}${qualifier}`;
  const identity =
    naturalIdentity.length <= 80
      ? naturalIdentity
      : `${plainMetadataText(input.name)} · ${pathFingerprint(input.path)}`;
  const authoredDescription = plainMetadataText(input.description);
  return clampDescription(
    authoredDescription
      ? translate("categoryAuthoredDescription", { identity, brand: siteConfig.name, description: authoredDescription })
      : translate("categoryDescription", { identity, brand: siteConfig.name, count: input.totalProductCount }),
  );
}

export function productFallbackTitle(input: {
  name: string;
  productCode: string;
}): string {
  const suffix = ` (${plainMetadataText(input.productCode)}) | ${siteConfig.name}`;
  return clampTextWithSuffix(plainMetadataText(input.name), suffix);
}

export function productFallbackDescription(input: {
  name: string;
  productCode: string;
  description?: string | null;
  categoryName: string;
  price?: number;
}, locale = "en", translator?: CatalogMetadataTranslator): string {
  const translate = translator ?? messages(locale);
  const identifier = `${plainMetadataText(input.name)} (${plainMetadataText(input.productCode)})`;
  const authoredDescription = plainMetadataText(input.description);
  return clampDescription(
    authoredDescription
      ? `${identifier}: ${authoredDescription}`
      : input.price == null
        ? translate("productDescriptionWithoutPrice", { identifier, category: input.categoryName, brand: siteConfig.name })
        : translate("productDescription", { identifier, category: input.categoryName, brand: siteConfig.name, currency: siteConfig.currency, price: input.price.toLocaleString(locale) }),
  );
}
