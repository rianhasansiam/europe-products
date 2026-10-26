"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import Image from "next/image";
import Link from "@/lib/i18n/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import { resolveBannerBackground } from "@/components/ui/tailwind-palette";

const AUTO_ROTATE_INTERVAL_MS = 3_000;

export type CarouselSlide = {
  id: string;
  image: string;
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  bgType: "gradient" | "solid";
  bgFrom: string | null;
  bgVia: string | null;
  bgTo: string | null;
  bgColor: string | null;
  link: string | null;
};

export default function CaroselBanner({ slides }: { slides: CarouselSlide[] }) {
  const i18n = useInterfaceTranslations("InterfaceComponentsCarouselBanner");
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;

    const intervalId = window.setInterval(() => {
      setActiveIndex((currentIndex) => (currentIndex + 1) % slides.length);
    }, AUTO_ROTATE_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [slides.length]);

  if (slides.length === 0) return null;

  // Slides can change between renders (admin edits + revalidation), so
  // clamp at render time to stay in range without an extra state sync.
  const safeIndex = Math.min(activeIndex, slides.length - 1);
  const activeDeal = slides[safeIndex];

  return (
    <div className="space-y-5">
      {/* Hero Banner */}
      <div
        className="storefront-banner relative overflow-hidden rounded-2xl border border-border bg-secondary"
        style={{ "--banner-background": resolveBannerBackground(activeDeal) } as CSSProperties}
      >
        <div className="relative z-10 flex min-h-[30vh] flex-row items-center justify-between gap-3 px-4 py-4 sm:gap-6 sm:px-8 sm:py-6 md:min-h-0 md:px-10 md:py-12">
          {/* Text Content */}
          <div
            key={activeDeal.id}
            className="min-w-0 flex-1 max-w-lg text-start text-foreground"
          >
            {activeDeal.badge && (
              <span className="mb-2 inline-block max-w-full truncate rounded-full bg-card px-2.5 py-1 text-[10px] font-semibold text-primary sm:px-3 sm:py-1 sm:text-xs md:mb-3">
                {i18n(activeDeal.badge)}
              </span>
            )}

            <h1 className="mb-2 text-xl font-bold leading-tight [overflow-wrap:anywhere] sm:text-3xl md:mb-3 md:text-4xl lg:text-5xl">
              {i18n(activeDeal.title)}
              <br />
              <span className="text-primary">{i18n(activeDeal.subtitle)}</span>
            </h1>

            <p className="mb-3 line-clamp-2 max-w-md text-xs leading-relaxed text-body sm:line-clamp-3 sm:text-sm md:mb-5 md:line-clamp-none md:text-base">
              {i18n(activeDeal.description)}
            </p>

            <div className="flex flex-wrap justify-start gap-2 md:gap-3">
              <Link
                href={activeDeal.link ?? "/products"}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:px-5 sm:text-sm md:px-6"
              >
                {i18n("Shop Now")}</Link>

              <Link
                href="/products"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-primary/30 bg-card px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:px-5 sm:text-sm md:px-6"
              >
                {i18n("View Offers")}</Link>
            </div>
          </div>

          {/* Hero Image */}
          <div
            key={`${activeDeal.id}-image`}
            className="relative size-20 shrink-0 min-[360px]:size-24 sm:size-36 md:size-64 lg:size-72"
          >
            <Image
              src={activeDeal.image}
              alt={i18n(activeDeal.subtitle)}
              fill
              className="rounded-full border-2 border-card object-cover shadow-sm md:border-4"
              sizes="(max-width: 359px) 80px, (max-width: 640px) 96px, (max-width: 768px) 144px, (max-width: 1024px) 256px, 288px"
              preload
            />

            <div className="absolute -end-1 -top-1 max-w-full truncate rounded-full bg-primary px-2 py-1 text-[9px] font-semibold text-primary-foreground shadow-sm sm:text-[10px] md:-end-2 md:-top-2 md:px-3 md:py-1.5 md:text-sm">
              {i18n(activeDeal.title)}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
