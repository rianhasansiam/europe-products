'use client'
import { useInterfaceTranslations } from "@/components/i18n/translate";


import React, { useRef, type CSSProperties } from 'react'
import Image from 'next/image'
import Link from "@/lib/i18n/navigation"
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { resolveBannerBackground } from '@/components/ui/tailwind-palette'


type DealBanner = {
  id: string
  image: string
  title: string
  subtitle: string
  bgClass: string
  link: string | null
}

type DealsCarouselProps = {
  deals: DealBanner[]
  title?: string
}

const DealsCarousel: React.FC<DealsCarouselProps> = ({
  deals,
  title = 'Black Friday Deals'
}) => {
  const i18n = useInterfaceTranslations("InterfaceProductsSlugComponentsDealsCarousel");
  const scrollRef = useRef<HTMLDivElement>(null)

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 280
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
      })
    }
  }

  if (!deals || deals.length === 0) {
    return null
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <h2 className="min-w-0 text-xl font-bold text-foreground [overflow-wrap:anywhere]">
          {i18n(title)}
        </h2>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => scroll('left')}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card hover:bg-secondary hover:border-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={i18n("Scroll left")}
          >
            <ChevronLeft className="w-4 h-4 text-body rtl:rotate-180" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card hover:bg-secondary hover:border-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={i18n("Scroll right")}
          >
            <ChevronRight className="w-4 h-4 text-body rtl:rotate-180" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="scrollbar-hide flex max-w-full gap-4 overflow-x-auto overscroll-x-contain pb-2 snap-x snap-mandatory"
      >
        {deals.map((deal) => (
          <Link
            key={deal.id}
            href={deal.link ?? "#"}
            className="storefront-banner relative min-w-[180px] h-24 rounded-xl overflow-hidden shrink-0 snap-start group bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            style={{ "--banner-background": resolveBannerBackground({ bgType: "solid", bgColor: deal.bgClass }) } as CSSProperties}
          >
            <Image
              src={deal.image}
              alt={i18n(deal.title)}
              fill
              className="object-cover opacity-15"
              sizes="180px"
            />
            <div className="absolute inset-0 flex min-w-0 flex-col items-center justify-center p-2 text-center text-foreground">
              <p className="max-w-full line-clamp-2 text-xs font-semibold opacity-90 [overflow-wrap:anywhere]">
                {i18n(deal.subtitle)}
              </p>
              <h3 className="max-w-full line-clamp-2 text-lg font-bold leading-tight [overflow-wrap:anywhere]">
                {i18n(deal.title)}
              </h3>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default DealsCarousel
