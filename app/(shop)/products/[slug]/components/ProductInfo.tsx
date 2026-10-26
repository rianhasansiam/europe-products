
import { useLocale } from "next-intl";

import { useInterfaceTranslations } from "@/components/i18n/translate";
import { Building2, Factory, Star } from "lucide-react";
import Link from "@/lib/i18n/navigation";

type CatalogEntity = {
  name: string;
  slug: string;
  status: "ACTIVE" | "INACTIVE";
};

type ProductInfoProps = {
  name: string;
  nameLocale?: string;
  productCode?: string | null;
  modelNumber?: string | null;
  gtin?: string | null;
  condition: string;
  series?: string | null;
  brand?: CatalogEntity | null;
  manufacturer?: CatalogEntity | null;
  rating: number;
  reviewCount: number;
};

const ProductInfo = ({
  name,
  nameLocale,
  productCode,
  modelNumber,
  gtin,
  condition,
  series,
  brand,
  manufacturer,
  rating,
  reviewCount,
}: ProductInfoProps) => {
  const locale = useLocale();
  const i18n = useInterfaceTranslations("InterfaceProductsSlugComponentsProductInfo");
  return (
    <div className="min-w-0 space-y-5">
      <div className="min-w-0">
        <h1 lang={nameLocale} dir="auto" className="text-2xl font-bold leading-snug text-foreground [overflow-wrap:anywhere] md:text-3xl">
          {name}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {productCode && (
            <span className="min-w-0 font-mono [overflow-wrap:anywhere]">
              {i18n("Product code:")}{productCode}
            </span>
          )}
          {reviewCount > 0 && (
            <a
              href="#reviews"
              className="inline-flex items-center gap-1 font-medium text-body hover:text-primary"
              aria-label={i18n("{value0} out of 5 from {value1} reviews", { value0: rating.toFixed(1), value1: reviewCount })}
            >
              <Star
                className="h-3.5 w-3.5 fill-brand-gold text-brand-gold"
                aria-hidden="true"
              />
              {rating.toFixed(1)} ({reviewCount.toLocaleString(locale)})
            </a>
          )}
        </div>
      </div>

      {(brand ||
        manufacturer ||
        modelNumber ||
        gtin ||
        series ||
        condition) && (
        <dl className="grid min-w-0 gap-3 rounded-xl border border-border bg-background p-3 text-sm sm:grid-cols-2">
          {brand && (
            <div className="min-w-0">
              <dt className="flex items-center gap-2.5 text-xs text-muted-foreground">
                <Building2
                  className="h-4 w-4 shrink-0 text-primary"
                  aria-hidden="true"
                />
                {i18n("Brand")}</dt>
              <dd className="min-w-0 truncate ps-6 font-semibold text-foreground">
                {brand.status === "ACTIVE" ? (
                  <Link
                    href={`/brands/${encodeURIComponent(brand.slug)}`}
                    className="hover:text-primary"
                  >
                    {brand.name}
                  </Link>
                ) : (
                  brand.name
                )}
              </dd>
            </div>
          )}
          {manufacturer && (
            <div className="min-w-0">
              <dt className="flex items-center gap-2.5 text-xs text-muted-foreground">
                <Factory
                  className="h-4 w-4 shrink-0 text-primary"
                  aria-hidden="true"
                />
                {i18n("Manufacturer")}</dt>
              <dd className="min-w-0 truncate ps-6 font-semibold text-foreground">
                {manufacturer.status === "ACTIVE" ? (
                  <Link
                    href={`/products?manufacturerSlug=${encodeURIComponent(manufacturer.slug)}`}
                    className="hover:text-primary"
                  >
                    {manufacturer.name}
                  </Link>
                ) : (
                  manufacturer.name
                )}
              </dd>
            </div>
          )}
          {modelNumber && (
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">{i18n("Model number")}</dt>
              <dd className="font-semibold text-foreground [overflow-wrap:anywhere]">
                {modelNumber}
              </dd>
            </div>
          )}
          {series && (
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">{i18n("Series")}</dt>
              <dd className="font-semibold text-foreground [overflow-wrap:anywhere]">
                {series}
              </dd>
            </div>
          )}
          {gtin && (
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">GTIN</dt>
              <dd className="font-mono font-semibold text-foreground [overflow-wrap:anywhere]">
                {gtin}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-muted-foreground">{i18n("Condition")}</dt>
            <dd className="font-semibold capitalize text-foreground">
              {condition}
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
};

export default ProductInfo;
