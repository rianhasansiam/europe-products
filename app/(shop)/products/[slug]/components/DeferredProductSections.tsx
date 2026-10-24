"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import dynamic from "next/dynamic";

function SectionFallback({ label }: { label: string }) {
  const i18n = useInterfaceTranslations("InterfaceProductsSlugComponentsDeferredProductSections");
  return (
    <div
      aria-label={i18n(label)}
      aria-busy="true"
      role="status"
      className="min-h-28 animate-pulse rounded-2xl border border-brand-border bg-white"
    />
  );
}

export const DeferredDealsCarousel = dynamic(
  () => import("./DealsCarousel"),
  {
    loading: () => <SectionFallback label="Loading current deals" />,
  },
);

export const DeferredReviewSection = dynamic(() => import("./ReviewSection"), {
  loading: () => <SectionFallback label="Loading product reviews" />,
});

export const DeferredRelatedProducts = dynamic(
  () => import("./RelatedProducts"),
  {
    loading: () => <SectionFallback label="Loading related products" />,
  },
);
