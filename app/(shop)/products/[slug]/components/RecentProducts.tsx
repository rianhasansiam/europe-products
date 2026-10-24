
import { useInterfaceTranslations } from "@/components/i18n/translate";
import React from 'react'
import Image from 'next/image'
import Link from "@/lib/i18n/navigation"
import CurrencyAmount from '@/components/currency/CurrencyAmount'

type RecentProductItem = {
  id: string
  slug: string
  name: string
  image: string
  price: number
  originalPrice: number
  discount: number
}

type RecentProductsProps = {
  products: RecentProductItem[]
  title?: string
}

const RecentProducts: React.FC<RecentProductsProps> = ({
  products,
  title = 'Recent Product'
}) => {
  const i18n = useInterfaceTranslations("InterfaceProductsSlugComponentsRecentProducts");
  if (!products || products.length === 0) {
    return null
  }

  return (
    <div className="min-w-0 rounded-2xl border border-gray-100 bg-white p-4">
      <h3 className="mb-4 text-lg font-bold text-gray-900 [overflow-wrap:anywhere]">
        {i18n(title)}
      </h3>

      <div className="space-y-3">
        {products.slice(0, 6).map((product) => (
          <Link
            key={product.id}
            href={`/products/${product.slug}`}
            className="group flex min-w-0 gap-3 rounded-xl p-2 transition-colors hover:bg-brand-light-bg"
          >
            {/* Thumbnail */}
            <div
              className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-100 shrink-0"
              style={{ position: "relative" }}
            >
              <Image
                src={product.image}
                alt={product.name}
                fill
                className="object-cover"
                sizes="64px"
              />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-gray-900 line-clamp-2 group-hover:text-brand-red transition-colors">
                {product.name}
              </h4>
              <div className="mt-1 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <CurrencyAmount
                  amountUSD={product.price}
                  className="max-w-full whitespace-nowrap text-sm font-bold text-brand-red"
                />
                {product.discount > 0 && (
                  <CurrencyAmount
                    amountUSD={product.originalPrice}
                    className="max-w-full whitespace-nowrap text-xs text-gray-400 line-through"
                  />
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default RecentProducts
