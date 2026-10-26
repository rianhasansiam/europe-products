"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import {
  Bookmark,
  Trash2,
  Truck,
  Tag,
  Sparkles,
  AlertTriangle,
  Check,
} from "lucide-react";
import Image from "next/image";
import Link from "@/lib/i18n/navigation";

import { CurrencyAmount } from "@/components/currency/CurrencyAmount";
import ColorBadge from "@/components/ui/ColorBadge";
import { cn } from "@/lib/utils";

import QuantityStepper from "./QuantityStepper";

type CartItem = {
  id: string;
  slug: string;
  productId: string;
  name: string;
  brand: string;
  image: string;
  price: number;
  originalPrice?: number;
  quantity: number;
  maxQuantity: number;
  color?: string;
  size?: string;
  variantName?: string;
  attributeSummary?: string;
  inStock: boolean;
  deliveryDays?: number;
  perks?: string[];
};

type CartItemCardProps = {
  item: CartItem;
  onQuantityChange: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
  onSaveForLater: (id: string) => void;
  selected: boolean;
  selectionDisabled?: boolean;
  onSelectionChange: (id: string) => void;
};

export default function CartItemCard({
  item,
  onQuantityChange,
  onRemove,
  onSaveForLater,
  selected,
  selectionDisabled = false,
  onSelectionChange,
}: CartItemCardProps) {
  const i18n = useInterfaceTranslations("InterfaceCartComponentsCartItemCard");
  const hasDiscount =
    typeof item.originalPrice === "number" && item.originalPrice > item.price;
  const lineTotal = item.price * item.quantity;
  const lineSavings = hasDiscount
    ? (item.originalPrice! - item.price) * item.quantity
    : 0;
  const nearMax = item.quantity >= item.maxQuantity;

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-card p-3 shadow-sm transition-colors duration-200 sm:p-4",
        selected
          ? "border-primary/35 ring-1 ring-primary/10"
          : "border-border hover:border-primary/40",
      )}
    >
      <div className="flex gap-2 sm:gap-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={selected}
          aria-label={
            selectionDisabled
              ? i18n("{product} is unavailable for checkout", { product: item.name })
              : selected ? i18n("Deselect {product} for checkout", { product: item.name }) : i18n("Select {product} for checkout", { product: item.name })
          }
          disabled={selectionDisabled}
          onClick={() => onSelectionChange(item.id)}
          className={cn(
            "grid h-9 w-9 sm:h-10 sm:w-10 shrink-0 place-items-center self-center rounded-xl border-2 transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40",
            selected
              ? "border-primary bg-primary text-white shadow-sm"
              : "border-border bg-card text-transparent hover:border-primary",
          )}
        >
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </button>

        <Link
          href={`/products/${item.slug}`}
          className="relative mt-2 aspect-square w-20 shrink-0 self-start overflow-hidden rounded-xl bg-muted min-[360px]:w-24 sm:mt-8 sm:w-32"
        >
          <Image
            src={item.image}
            alt={item.name}
            fill
            sizes="(max-width: 359px) 80px, (max-width: 639px) 96px, 128px"
            className="object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.02]"
          />
          {hasDiscount && (
            <span className="absolute start-1.5 top-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground shadow">
              -
              {Math.round(
                ((item.originalPrice! - item.price) / item.originalPrice!) *
                  100,
              )}
              %
            </span>
          )}
        </Link>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-col gap-1.5 min-[380px]:flex-row min-[380px]:items-start min-[380px]:justify-between min-[380px]:gap-2">
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {item.brand}
              </p>
              <Link
                href={`/products/${item.slug}`}
                className="mt-0.5 line-clamp-2 text-sm font-semibold text-foreground [overflow-wrap:anywhere] hover:text-primary sm:text-base"
              >
                {item.name}
              </Link>
              {(item.color || item.size) && (
                <ColorBadge color={item.color} size={item.size} className="mt-1" />
              )}
              {(item.variantName || item.attributeSummary) && (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground [overflow-wrap:anywhere]">
                  {[item.variantName, item.attributeSummary]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>

            <div className="text-start min-[380px]:shrink-0 min-[380px]:text-end">
              <p className="text-base font-bold text-primary sm:text-lg">
                <CurrencyAmount amountUSD={lineTotal} />
              </p>
              {hasDiscount && (
                <p className="text-xs text-muted-foreground line-through">
                  <CurrencyAmount
                    amountUSD={item.originalPrice! * item.quantity}
                  />
                </p>
              )}
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                <CurrencyAmount amountUSD={item.price} /> {i18n("each")}</p>
            </div>
          </div>

          {/* Perks */}
          {(item.perks?.length || item.deliveryDays) && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {item.deliveryDays && (
                <span className="inline-flex items-center gap-1 rounded-full bg-success-surface px-2 py-0.5 text-[11px] font-medium text-success">
                  <Truck className="h-3 w-3" />
                  {item.deliveryDays}{i18n("-day delivery")}</span>
              )}
              {item.perks?.map((perk) => (
                <span
                  key={perk}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground"
                >
                  <Sparkles className="h-3 w-3" />
                  {perk}
                </span>
              ))}
            </div>
          )}

          {hasDiscount && (
            <p className="mt-2 inline-flex w-fit items-center gap-1 rounded-md bg-success-surface px-2 py-0.5 text-[11px] font-semibold text-success">
              <Tag className="h-3 w-3" />
              {i18n("You're saving")}<CurrencyAmount amountUSD={lineSavings} />
            </p>
          )}

          {/* Bottom row: quantity + actions */}
          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-3">
              <QuantityStepper
                value={item.quantity}
                min={1}
                max={item.maxQuantity}
                onChange={(q) => onQuantityChange(item.id, q)}
              />
              {nearMax && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700">
                  <AlertTriangle className="h-3 w-3" />
                  {i18n("Max")}{item.maxQuantity}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  onSaveForLater(item.id);
                }}
                className="inline-flex items-center gap-1.5 min-h-10 rounded-xl px-2.5 py-2 text-xs font-semibold text-body transition-colors hover:bg-muted hover:text-primary"
              >
                <Bookmark className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{i18n("Save for later")}</span>
                <span className="sm:hidden">{i18n("Save")}</span>
              </button>
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                aria-label={i18n("Remove from cart")}
                className="inline-flex items-center gap-1.5 min-h-10 rounded-xl px-2.5 py-2 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{i18n("Remove")}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
