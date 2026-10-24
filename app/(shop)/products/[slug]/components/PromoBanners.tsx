
import { useInterfaceTranslations } from "@/components/i18n/translate";
import React from 'react'
import Image from 'next/image'
import Link from "@/lib/i18n/navigation"

import { resolveColorValue } from '@/components/ui/tailwind-palette'

type PromoBanner = {
  id: string
  image: string
  title: string
  subtitle: string
  discount: string
  bgClass: string
  link: string | null
}

type PromoBannersProps = {
  banners: PromoBanner[]
}

const PromoBanners: React.FC<PromoBannersProps> = ({ banners }) => {
  const i18n = useInterfaceTranslations("InterfaceProductsSlugComponentsPromoBanners");
  if (!banners || banners.length === 0) {
    return null
  }

  return (
    <div className="min-w-0 space-y-4">
      {banners.map((banner) => (
        <Link
          key={banner.id}
          href={banner.link ?? "#"}
          style={{
            backgroundColor: resolveColorValue(banner.bgClass) ?? "var(--brand-black)",
            position: "relative",
          }}
          className="group relative block h-48 min-w-0 overflow-hidden rounded-2xl"
        >
          <Image
            src={banner.image}
            alt={banner.title}
            fill
            className="object-cover opacity-70 group-hover:scale-105 transition-transform"
            sizes="(max-width: 1024px) 100vw, 25vw"
          />
          <div className="absolute inset-0 flex min-w-0 flex-col items-center justify-center p-4 text-center text-brand-white">
            <p className="text-xs font-medium opacity-80">{i18n("SUPER SALE")}</p>
            <h3 className="max-w-full line-clamp-2 text-2xl font-black leading-tight [overflow-wrap:anywhere]">
              {banner.title}
            </h3>
            <p className="max-w-full line-clamp-2 text-xl font-bold leading-tight text-brand-gold [overflow-wrap:anywhere]">
              {banner.subtitle}
            </p>
            <span className="mt-2 max-w-full rounded-full bg-white/20 px-3 py-1 text-sm font-semibold [overflow-wrap:anywhere]">
              {banner.discount}
            </span>
          </div>
        </Link>
      ))}
    </div>
  )
}

export default PromoBanners
