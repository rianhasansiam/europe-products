'use client'
import { useInterfaceTranslations } from "@/components/i18n/translate";


import React, { useRef } from 'react'
import Image from 'next/image'
import Link from "@/lib/i18n/navigation"
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { resolveColorValue } from '@/components/ui/tailwind-palette'

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
        behavior: 'smooth'
      })
    }
  }

  if (!deals || deals.length === 0) {
    return null
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <h2 className="min-w-0 text-xl font-bold text-gray-900 [overflow-wrap:anywhere]">
          {i18n(title)}
        </h2>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => scroll('left')}
            className="p-2 rounded-full border border-gray-200 hover:bg-brand-light-bg hover:border-brand-red transition-colors"
            aria-label={i18n("Scroll left")}
          >
            <ChevronLeft className="w-4 h-4 text-gray-600 rtl:rotate-180" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="p-2 rounded-full border border-gray-200 hover:bg-brand-light-bg hover:border-brand-red transition-colors"
            aria-label={i18n("Scroll right")}
          >
            <ChevronRight className="w-4 h-4 text-gray-600 rtl:rotate-180" />
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
            style={{
              backgroundColor: resolveColorValue(deal.bgClass) ?? "var(--brand-black)",
              position: "relative",
            }}
            className="relative min-w-[180px] h-24 rounded-xl overflow-hidden shrink-0 snap-start group"
          >
            <Image
              src={deal.image}
              alt={i18n(deal.title)}
              fill
              className="object-cover opacity-60 group-hover:scale-105 transition-transform"
              sizes="180px"
            />
            <div className="absolute inset-0 flex min-w-0 flex-col items-center justify-center p-2 text-center text-white">
              <p className="max-w-full line-clamp-2 text-xs font-semibold opacity-90 [overflow-wrap:anywhere]">
                {i18n(deal.subtitle)}
              </p>
              <h3 className="max-w-full line-clamp-2 text-lg font-black leading-tight [overflow-wrap:anywhere]">
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
