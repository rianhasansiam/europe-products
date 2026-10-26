'use client'
import { useCurrency } from "@/components/currency/CurrencyProvider";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import React, { useState, useCallback } from 'react'
import Image from 'next/image'
import Link from "@/lib/i18n/navigation"
import { useRouter } from "@/lib/i18n/navigation";import { ShoppingBag } from 'lucide-react'
import { useSession } from '@/lib/auth/use-app-session'
import { useDispatch } from 'react-redux'

import {
  canUseServerCart,
  createCartItemOnServer,
  fetchServerCartSnapshot,
  type CartItem,
} from '@/features/cart/api'
import { computeCartSummary } from '@/features/cart/summary'
import {
  DEFAULT_CART_STOCK,
  readLocalCart,
  upsertLocalCartItem,
  writeLocalCart,
} from '@/features/cart/storage'
import { toast } from '@/lib/feedback'
import type { AppDispatch } from '@/store'
import {
  setCartData,
  setCartError as setCartErrorAction,
} from '@/store/slices/cart.slice'
import { ButtonLoader } from '@/components/ui/loading'
import CurrencyAmount from '@/components/currency/CurrencyAmount'
import { createEventId, trackLocalCartAddition } from '@/lib/analytics/meta-pixel'

type RecentProductItem = {
  id: string
  productCode?: string | null
  variantCount?: number
  inStock?: boolean
  slug: string
  name: string
  image: string
  price: number
  originalPrice: number
  discount: number
}

type RelatedProductsProps = {
  products: RecentProductItem[]
  title?: string
}

const ITEMS_PER_PAGE = 12
const ITEMS_PER_LOAD = 8

const RelatedProducts: React.FC<RelatedProductsProps> = ({
  products,
  title = 'More Relevant Product',
}) => {
  const i18n = useInterfaceTranslations("InterfaceProductsSlugComponentsRelatedProducts");
  const { pricingReady } = useCurrency();
  const dispatch = useDispatch<AppDispatch>()
  const router = useRouter()
  const { data: session, status } = useSession()
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE)
  const [isLoading, setIsLoading] = useState(false)
  const [cartBusyId, setCartBusyId] = useState<string | null>(null)

  const handleLoadMore = useCallback(() => {
    setIsLoading(true)
    // Simulate network delay for better UX
    setTimeout(() => {
      setVisibleCount((prev) => prev + ITEMS_PER_LOAD)
      setIsLoading(false)
    }, 500)
  }, [])

  const handleAddToBag = useCallback(async (
    product: RecentProductItem,
  ) => {
    if (pricingReady === false || cartBusyId) return
    if ((product.variantCount ?? 1) > 1) {
      router.push(`/products/${product.slug}`)
      return
    }

    const canUseServer = canUseServerCart(session?.user?.role, status)
    dispatch(setCartErrorAction(null))
    setCartBusyId(product.id)

    if (canUseServer) {
      try {
        await createCartItemOnServer(product.id)
        const snapshot = await fetchServerCartSnapshot()
        writeLocalCart(snapshot.items)
        dispatch(setCartData(snapshot))
        toast.success(i18n("Added to cart"))
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to add item to cart.'
        dispatch(setCartErrorAction(message))
        toast.error(i18n(message))
      } finally {
        setCartBusyId(null)
      }
      return
    }

    const localBefore = readLocalCart()
    const optimisticItem: CartItem = {
      id: `local:${product.id}`,
      productId: product.id,
      productCode: product.productCode,
      slug: product.slug,
      name: product.name,
      image: product.image,
      quantity: 1,
      unitPrice: product.price,
      originalPrice: product.originalPrice ?? product.price,
      lineTotal: product.price,
      stock: DEFAULT_CART_STOCK,
      status: 'ACTIVE',
    }

    const nextLocal = upsertLocalCartItem(localBefore, optimisticItem)
    writeLocalCart(nextLocal)
    dispatch(setCartData({ items: nextLocal, summary: computeCartSummary(nextLocal) }))
    if (product.inStock !== false && (product.variantCount ?? 1) > 0) {
      trackLocalCartAddition(localBefore, nextLocal, createEventId())
    }
    setCartBusyId(null)
    toast.success(i18n("Added to cart"))
  }, [cartBusyId, dispatch, i18n, pricingReady, router, session?.user?.role, status])

  if (!products || products.length === 0) {
    return null
  }

  const visibleProducts = products.slice(0, visibleCount)
  const hasMore = visibleCount < products.length

  return (
    <div className="min-w-0 space-y-6">
      <h2 className="text-xl font-bold text-foreground [overflow-wrap:anywhere]">
        {i18n(title)}
      </h2>

      <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
        {visibleProducts.map((product) => (
          <article
            key={product.id}
            className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-primary hover:shadow-lg"
          >
            {/* Image Container */}
            <Link href={`/products/${product.slug}`} className="block min-w-0">
              <div
                className="relative aspect-square bg-background p-2"
                style={{ position: "relative" }}
              >
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  className="object-contain p-2 group-hover:scale-105 transition-transform"
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                />

                {/* Discount Badge */}
                {product.discount > 0 && (
                  <span className="absolute top-2 start-2 px-1.5 py-0.5 bg-primary text-primary-foreground text-[10px] font-semibold rounded">
                    -{product.discount}%
                  </span>
                )}
              </div>
            </Link>

            {/* Product Info */}
            <div className="flex min-w-0 flex-1 flex-col p-3">
              <Link href={`/products/${product.slug}`} className="block min-w-0">
                {/* Delivery Time */}
                <p className="text-[10px] text-muted-foreground mb-1">{i18n("Delivery 2 Hours")}</p>

                {/* Price */}
                <div className="mb-2 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <CurrencyAmount
                    amountUSD={product.price}
                    className="max-w-full whitespace-nowrap text-sm font-bold text-foreground"
                  />
                  {product.discount > 0 && (
                    <CurrencyAmount
                      amountUSD={product.originalPrice}
                      className="max-w-full whitespace-nowrap text-[10px] text-muted-foreground line-through"
                    />
                  )}
                </div>

                {/* Product Name */}
                <h3 className="mb-3 line-clamp-1 text-xs text-body [overflow-wrap:anywhere]">
                  {product.name}
                </h3>
              </Link>

              {/* Add to Bag Button */}
              <button
                onClick={() => {
                  void handleAddToBag(product)
                }}
                title={pricingReady === false ? "Prices are temporarily unavailable" : undefined}
                disabled={pricingReady === false || cartBusyId !== null}
                aria-busy={cartBusyId === product.id}
                className="flex min-h-11 w-full min-w-0 items-center justify-center gap-1 rounded-lg bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
              >
                {cartBusyId === product.id ? (
                  <ButtonLoader label={i18n("Adding...")} />
                ) : (
                  <>
                    <ShoppingBag className="h-3 w-3 shrink-0" />
                    <span className="truncate">{i18n("Add to bag")}</span>
                  </>
                )}
              </button>
            </div>
          </article>
        ))}
      </div>

      {/* Load More Button */}
      {hasMore && (
        <div className="text-center pt-4">
          <button
            onClick={handleLoadMore}
            disabled={isLoading}
            aria-busy={isLoading}
            className="inline-flex items-center gap-2 px-8 py-2.5 bg-card border-2 border-border text-body font-medium rounded-lg hover:border-primary hover:bg-background transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <ButtonLoader label={i18n("Loading...")} />
            ) : (
              i18n("Load More")
            )}
          </button>
        </div>
      )}
    </div>
  )
}

export default RelatedProducts
