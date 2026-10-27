"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import Image from "next/image";
import Link from "@/lib/i18n/navigation";
import { ShoppingCart, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { CurrencyAmount } from "@/components/currency/CurrencyAmount";
import { cn } from "@/lib/utils";
import {
  LIST_ITEM_TRANSITION,
  LIST_ITEM_VARIANTS,
} from "@/lib/motion/list-removal";

type SavedItem = {
  id: string;
  productId: string;
  slug: string;
  name: string;
  image: string;
  price: number;
  originalPrice?: number;
  variantName?: string | null;
  attributeSummary?: string | null;
  inStock: boolean;
};

type SavedForLaterProps = {
  items: SavedItem[];
  onMoveToCart: (id: string) => void;
  onRemove: (id: string) => void;
};

export default function SavedForLater({
  items,
  onMoveToCart,
  onRemove,
}: SavedForLaterProps) {
  const i18n = useInterfaceTranslations("InterfaceCartComponentsSavedForLater");
  if (items.length === 0) return null;

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-foreground sm:text-xl">
            {i18n("Saved for later")}</h2>
          <p className="text-xs text-muted-foreground">
            {i18n("{count, plural, one {# item parked for next time} other {# items parked for next time}}", { count: items.length })}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <AnimatePresence initial={false} mode="popLayout">
          {items.map((item) => (
            <motion.article
              key={item.id}
              layout
              initial="initial"
              animate="animate"
              exit="exit"
              variants={LIST_ITEM_VARIANTS}
              transition={LIST_ITEM_TRANSITION}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-colors duration-200 hover:border-primary/40"
            >
              <Link
                href={`/products/${item.slug}`}
                className="relative block aspect-square overflow-hidden bg-muted"
              >
                <Image
                  src={item.image}
                  alt={item.name}
                  fill
                  sizes="(max-width: 640px) 50vw, 25vw"
                  className={cn(
                    "object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.02]",
                    !item.inStock && "grayscale",
                  )}
                />
                {!item.inStock && (
                  <div className="absolute inset-x-0 bottom-0 bg-black/55 px-2 py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-white">
                    {i18n("Out of stock")}</div>
                )}
              </Link>

              <button
                type="button"
                onClick={() => onRemove(item.id)}
                aria-label={i18n("Remove from saved items")}
                className="absolute end-1.5 top-1.5 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-body shadow backdrop-blur-md transition-all duration-200 hover:bg-card hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>

              <div className="p-3">
                <Link
                  href={`/products/${item.slug}`}
                  className="mt-0.5 line-clamp-2 text-sm font-semibold text-foreground hover:text-primary"
                >
                  {item.name}
                </Link>
                {(item.variantName || item.attributeSummary) && (
                  <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">
                    {[item.variantName, item.attributeSummary]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
                <div className="mt-1 flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                  <span className="min-w-0 max-w-full text-sm font-bold text-primary [overflow-wrap:anywhere]">
                    <CurrencyAmount amountUSD={item.price} />
                  </span>
                  {item.originalPrice && item.originalPrice > item.price && (
                    <span className="min-w-0 max-w-full text-[10px] text-muted-foreground line-through [overflow-wrap:anywhere]">
                      <CurrencyAmount amountUSD={item.originalPrice} />
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  disabled={!item.inStock}
                  onClick={() => onMoveToCart(item.id)}
                  className={cn(
                    "mt-2 inline-flex w-full items-center justify-center gap-1 min-h-10 rounded-xl px-2 py-2 text-[11px] font-semibold transition-all duration-200",
                    item.inStock
                      ? "bg-primary/10 text-primary hover:bg-primary/20"
                      : "cursor-not-allowed bg-muted text-muted-foreground",
                  )}
                >
                  <ShoppingCart className="h-3 w-3" />
                  {item.inStock ? i18n("Move to cart") : i18n("Notify me")}
                </button>
              </div>
            </motion.article>
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}
