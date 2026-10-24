"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import Image from "next/image";
import Link from "@/lib/i18n/navigation";
import { useEffect, useState } from "react";

import { resolveBannerBackground } from "@/components/ui/tailwind-palette";

const AUTO_ROTATE_INTERVAL_MS = 3_000;

/**
 * Home page hero carousel.
 *
 * Slides are managed from the admin "Banners" page (CAROUSEL type in the
 * unified `Banner` model) and passed in from the server component. Each
 * slide paints its background either as a gradient (bgFrom/bgVia/bgTo)
 * or a single solid color (bgColor), selected by `bgType`.
 *
 * Colors are stored as hex values (chosen with the admin color picker) and
 * applied via inline `style`. Older rows that still hold Tailwind class
 * strings are resolved to hex by `resolveBannerBackground`, so existing
 * slides keep rendering.
 */
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

/** Build the hero panel background as a CSS value (hex gradient or solid). */
function heroBackground(slide: CarouselSlide): string {
  return resolveBannerBackground({
    bgType: slide.bgType,
    bgColor: slide.bgColor,
    bgFrom: slide.bgFrom,
    bgVia: slide.bgVia,
    bgTo: slide.bgTo,
  });
}

/** Compact background for the deal selector cards (no "via" stop). */
function cardBackground(slide: CarouselSlide): string {
  return resolveBannerBackground({
    bgType: slide.bgType,
    bgColor: slide.bgColor,
    bgFrom: slide.bgFrom,
    bgTo: slide.bgTo,
  });
}

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
        className="relative mx-0 mt-4 overflow-hidden rounded-2xl transition-all duration-700 sm:mx-4 lg:mx-6"
        style={{ background: heroBackground(activeDeal) }}
      >
        {/* Background Effects */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 start-0 w-72 h-72 bg-white rounded-full -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 end-0 w-96 h-96 bg-white rounded-full translate-x-1/3 translate-y-1/3" />
          <div className="absolute top-1/2 left-1/2 w-48 h-48 bg-white rounded-full -translate-x-1/2 -translate-y-1/2" />
        </div>

        <div className="relative z-10 flex min-h-[30vh] flex-row items-center justify-between gap-3 px-4 py-4 sm:gap-6 sm:px-8 sm:py-6 md:min-h-0 md:px-10 md:py-12">
          {/* Text Content */}
          <div
            key={activeDeal.id}
            className="min-w-0 flex-1 max-w-lg text-start text-white animate-in fade-in slide-in-from-start-5 duration-700"
          >
            <span className="mb-2 inline-block max-w-full truncate rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium backdrop-blur-sm sm:px-3 sm:py-1 sm:text-xs md:mb-3">
              🎉 {i18n(activeDeal.badge)}
            </span>

            <h1 className="mb-2 text-xl font-black leading-tight [overflow-wrap:anywhere] sm:text-3xl md:mb-3 md:text-4xl lg:text-5xl">
              {i18n(activeDeal.title)}
              <br />
              <span className="text-brand-gold">{i18n(activeDeal.subtitle)}</span>
            </h1>

            <p className="mb-3 line-clamp-2 max-w-md text-[11px] leading-snug text-white/80 sm:line-clamp-3 sm:text-sm md:mb-5 md:line-clamp-none md:text-base">
              {i18n(activeDeal.description)}
            </p>

            <div className="flex flex-wrap justify-start gap-2 md:gap-3">
              <Link
                href={activeDeal.link ?? "/products"}
                className="rounded-full bg-brand-red px-3 py-1.5 text-[11px] font-bold text-brand-white shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:bg-brand-red-hover hover:shadow-xl sm:px-4 sm:py-2 sm:text-xs md:px-6 md:py-2.5 md:text-sm"
              >
                {i18n("Shop Now")}</Link>

              <Link
                href="/products"
                className="rounded-full border border-white/50 px-3 py-1.5 text-[11px] font-semibold text-white transition-all duration-300 hover:bg-white/10 sm:px-4 sm:py-2 sm:text-xs md:border-2 md:px-6 md:py-2.5 md:text-sm"
              >
                {i18n("View Offers")}</Link>
            </div>
          </div>

          {/* Hero Image */}
          <div
            key={`${activeDeal.id}-image`}
            className="relative size-20 shrink-0 animate-in fade-in zoom-in-95 duration-700 min-[360px]:size-24 sm:size-36 md:size-64 lg:size-72"
          >
            <Image
              src={activeDeal.image}
              alt={i18n(activeDeal.subtitle)}
              fill
              className="rounded-full border-2 border-white/30 object-cover shadow-2xl md:border-4"
              sizes="(max-width: 359px) 80px, (max-width: 640px) 96px, (max-width: 768px) 144px, (max-width: 1024px) 256px, 288px"
              preload
            />

            <div className="absolute -end-1 -top-1 max-w-full animate-bounce truncate rounded-full bg-brand-red px-2 py-1 text-[9px] font-black text-brand-white shadow-lg sm:text-[10px] md:-end-2 md:-top-2 md:px-3 md:py-1.5 md:text-sm">
              {i18n(activeDeal.title)}
            </div>
          </div>
        </div>
      </div>

      {/* Deal Cards */}
      {/* {slides.length > 1 && (
        <div className="px-3 sm:px-4 lg:px-6">
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {slides.map((card, index) => {
              const isActive = index === safeIndex;

              return (
                <button
                  key={card.id}
                  onClick={() => setActiveIndex(index)}
                  aria-pressed={isActive}
                  style={{ background: cardBackground(card) }}
                  className={`rounded-xl min-w-[160px] sm:min-w-[180px] h-28 sm:h-32 shrink-0
                  shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300
                  cursor-pointer relative overflow-hidden group flex-1 text-start
                  ${
                    isActive
                      ? "ring-4 ring-brand-red ring-offset-2 ring-offset-white scale-[1.03]"
                      : "ring-1 ring-white/20"
                  }
                `}
                >
                  <Image
                    src={card.image}
                    alt={card.subtitle}
                    fill
                    sizes="(max-width: 640px) 160px, (max-width: 1024px) 180px, 25vw"
                    className={`object-cover transition-all duration-500 ${
                      isActive
                        ? "opacity-60 scale-110"
                        : "opacity-40 group-hover:opacity-50 group-hover:scale-110"
                    }`}
                  />

                  <div className="absolute inset-0 bg-linear-to-t from-black/50 to-transparent" />

                  <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-3">
                    <h3 className="text-lg sm:text-xl font-black text-white drop-shadow-lg mb-0.5">
                      {card.title}
                    </h3>
                    <p className="text-xs sm:text-sm font-semibold text-white/90 drop-shadow">
                      {card.subtitle}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )} */}
    </div>
  );
}
