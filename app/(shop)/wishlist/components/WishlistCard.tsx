"use client";
import { useLocale } from "next-intl";

import { useInterfaceTranslations } from "@/components/i18n/translate";


import {
  Heart,
  ShoppingCart,
  Star,
  Trash2,
  TrendingDown,
  Share2,
  Check,
} from "lucide-react";
import Image from "next/image";
import Link from "@/lib/i18n/navigation";

import { CurrencyAmount } from "@/components/currency/CurrencyAmount";
import { cn } from "@/lib/utils";
import type { WishlistItem } from "@/features/wishlist/api";

type WishlistView = "grid" | "list";

type WishlistCardProps = {
  item: WishlistItem;
  view: WishlistView;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onMoveToCart: (id: string) => void;
  onShare: (id: string) => void;
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function WishlistCard({
  item,
  view,
  selected,
  onToggleSelect,
  onRemove,
  onMoveToCart,
  onShare,
}: WishlistCardProps) {
  const locale = useLocale();
  const i18n = useInterfaceTranslations("InterfaceWishlistComponentsWishlistCard");
  const discount = item.originalPrice
    ? Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100)
    : 0;

  const hasPriceDrop =
    typeof item.priceDropFromAdded === "number" && item.priceDropFromAdded > 0;

  if (view === "list") {
    return (
      <article
        className={cn(
          "group relative flex gap-2 rounded-2xl border bg-white p-3 shadow-sm transition-all duration-300 sm:gap-4 sm:p-4",
          selected
            ? "border-brand-red ring-2 ring-brand-red/20"
            : "border-brand-border hover:border-brand-red hover:shadow-md",
        )}
      >
        <SelectCheckbox
          selected={selected}
          onToggle={() => onToggleSelect(item.id)}
          className="absolute start-5 top-5 z-10 sm:static"
        />

        <Link
          href={`/products/${item.slug ?? item.id}`}
          className="relative aspect-square w-20 shrink-0 self-start overflow-hidden rounded-xl bg-gray-50 min-[360px]:w-24 sm:w-32"
        >
          <Image
            src={item.image}
            alt={item.name}
            fill
            sizes="(max-width: 359px) 80px, (max-width: 639px) 96px, 128px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {!item.inStock && (
            <span className="absolute inset-0 grid place-items-center bg-black/40 text-[11px] font-semibold uppercase tracking-wide text-white">
              {i18n("Out of stock")}</span>
          )}
        </Link>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-w-0 flex-col gap-1.5 min-[400px]:flex-row min-[400px]:items-start min-[400px]:justify-between min-[400px]:gap-2">
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-brand-text-muted">
                {item.brand} • {item.category}
              </p>
              <Link
                href={`/products/${item.slug ?? item.id}`}
                className="mt-0.5 line-clamp-2 text-sm font-semibold text-brand-black [overflow-wrap:anywhere] hover:text-brand-red sm:text-base"
              >
                {item.name}
              </Link>
            </div>
            <Badges item={item} discount={discount} />
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 sm:flex-nowrap">
            <RatingStars rating={item.rating} />
            <span>({item.reviewCount.toLocaleString(locale)})</span>
            <span aria-hidden>•</span>
            <span>{i18n("Saved")}{timeAgo(item.addedAt)}</span>
          </div>

          <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-3">
            <PriceBlock item={item} hasPriceDrop={hasPriceDrop} />
            <ActionButtons
              inStock={item.inStock}
              onRemove={() => onRemove(item.id)}
              onMoveToCart={() => onMoveToCart(item.id)}
              onShare={() => onShare(item.id)}
            />
          </div>
        </div>
      </article>
    );
  }

  // Grid view
  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-300",
        selected
          ? "border-brand-red ring-2 ring-brand-red/20"
          : "border-brand-border hover:-translate-y-1 hover:border-brand-red hover:shadow-xl",
      )}
    >
      {/* Image */}
      <div className="relative aspect-4/5 overflow-hidden bg-gray-50">
        <Link href={`/products/${item.slug ?? item.id}`}>
          <Image
            src={item.image}
            alt={item.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className={cn(
              "object-cover transition-transform duration-700 ease-out group-hover:scale-110",
              !item.inStock && "grayscale",
            )}
          />
        </Link>

        {/* Top row: select + remove + share */}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-2.5">
          <SelectCheckbox
            selected={selected}
            onToggle={() => onToggleSelect(item.id)}
          />
          <div className="flex flex-col gap-1.5">
            <IconAction
              label={i18n("Share")}
              onClick={() => onShare(item.id)}
              tone="neutral"
            >
              <Share2 className="h-4 w-4" />
            </IconAction>
            <IconAction
              label={i18n("Remove from wishlist")}
              onClick={() => onRemove(item.id)}
              tone="danger"
            >
              <Trash2 className="h-4 w-4" />
            </IconAction>
          </div>
        </div>

        {/* Badges (left) */}
        <div className="pointer-events-none absolute start-2.5 top-16 flex max-w-[calc(100%-1.25rem)] flex-col gap-1.5">
          {item.badge && (
            <span className="block max-w-full truncate rounded-full bg-brand-red px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-brand-white shadow-md">
              {item.badge}
            </span>
          )}
          {discount > 0 && (
            <span className="rounded-full bg-brand-red px-2.5 py-1 text-[10px] font-bold text-brand-white shadow-md">
              -{discount}%
            </span>
          )}
        </div>

        {hasPriceDrop && (
          <div className="absolute bottom-2.5 start-2.5 inline-flex max-w-[calc(100%-1.25rem)] items-center gap-1.5 rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-md">
            <TrendingDown className="h-3 w-3 shrink-0" />
            <span className="min-w-0 truncate">
              <span className="hidden min-[360px]:inline">{i18n("Dropped")}</span>
              <CurrencyAmount amountUSD={item.priceDropFromAdded ?? 0} />
            </span>
            <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-emerald-400 opacity-60" />
          </div>
        )}

        {!item.inStock && (
          <div className="absolute inset-x-0 bottom-0 bg-black/55 px-3 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
            {i18n("Out of stock")}</div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-brand-text-muted">
          {item.brand} • {item.category}
        </p>
        <Link href={`/products/${item.slug ?? item.id}`}>
          <h3 className="mt-1 line-clamp-2 min-h-10 text-sm font-semibold leading-tight text-brand-black transition-colors [overflow-wrap:anywhere] hover:text-brand-red">
            {item.name}
          </h3>
        </Link>

        <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[11px] text-gray-500">
          <RatingStars rating={item.rating} />
          <span className="min-w-0 truncate">
            ({item.reviewCount.toLocaleString(locale)})
          </span>
        </div>

        <div className="mt-auto pt-3">
          <PriceBlock item={item} hasPriceDrop={hasPriceDrop} />
          <p className="mt-1 text-[11px] text-gray-400">
            {i18n("Saved")}{timeAgo(item.addedAt)}
          </p>

          <button
            type="button"
            disabled={!item.inStock}
            onClick={() => onMoveToCart(item.id)}
            className={cn(
              "mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200",
              item.inStock
                ? "bg-brand-red text-brand-white shadow-sm hover:-translate-y-0.5 hover:bg-brand-red-hover hover:shadow-md"
                : "cursor-not-allowed bg-gray-100 text-gray-400",
            )}
          >
            <ShoppingCart className="h-4 w-4" />
            {item.inStock ? (
              <>
                <span className="min-[360px]:hidden">{i18n("Add")}</span>
                <span className="hidden min-[360px]:inline">{i18n("Move to cart")}</span>
              </>
            ) : (
              i18n("Notify me")
            )}
          </button>
        </div>
      </div>
    </article>
  );
}

/* -------------------- Sub-components -------------------- */

function Badges({
  item,
  discount,
}: {
  item: WishlistItem;
  discount: number;
}) {
  return (
    <div className="flex min-w-0 max-w-full flex-col items-start gap-1 min-[400px]:shrink-0 min-[400px]:items-end">
      {item.badge && (
        <span className="block max-w-full truncate rounded-full bg-brand-red px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-white">
          {item.badge}
        </span>
      )}
      {discount > 0 && (
        <span className="rounded-full bg-brand-red px-2 py-0.5 text-[10px] font-bold text-brand-white">
          -{discount}%
        </span>
      )}
    </div>
  );
}

function PriceBlock({
  item,
  hasPriceDrop,
}: {
  item: WishlistItem;
  hasPriceDrop: boolean;
}) {
  const i18n = useInterfaceTranslations("InterfaceWishlistComponentsWishlistCard");
  return (
    <div className="flex max-w-full flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className="max-w-full text-base font-extrabold text-brand-red [overflow-wrap:anywhere] sm:text-lg">
        <CurrencyAmount amountUSD={item.price} />
      </span>
      {item.originalPrice && item.originalPrice > item.price && (
        <span className="max-w-full text-xs text-gray-400 line-through [overflow-wrap:anywhere]">
          <CurrencyAmount amountUSD={item.originalPrice} />
        </span>
      )}
      {hasPriceDrop && (
        <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
          <TrendingDown className="h-3 w-3" />
          {i18n("Drop")}</span>
      )}
    </div>
  );
}

function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "h-3 w-3",
            i < Math.round(rating)
              ? "fill-brand-gold text-brand-gold"
              : "text-gray-200",
          )}
        />
      ))}
    </div>
  );
}

function SelectCheckbox({
  selected,
  onToggle,
  className,
}: {
  selected: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const i18n = useInterfaceTranslations("InterfaceWishlistComponentsWishlistCard");
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      aria-label={selected ? i18n("Deselect item") : i18n("Select item")}
      className={cn(
        "grid h-11 w-11 place-items-center rounded-xl border-2 backdrop-blur-md transition-all duration-200",
        selected
          ? "border-brand-red bg-brand-red text-brand-white shadow-md"
          : "border-white/80 bg-white/70 text-transparent hover:border-brand-red hover:text-brand-red",
        className,
      )}
    >
      <Check className="h-4 w-4" />
    </button>
  );
}

function IconAction({
  label,
  onClick,
  tone,
  children,
}: {
  label: string;
  onClick: () => void;
  tone: "neutral" | "danger";
  children: React.ReactNode;
}) {
  const i18n = useInterfaceTranslations("InterfaceWishlistComponentsWishlistCard");
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={i18n(label)}
      className={cn(
        "grid h-11 w-11 place-items-center rounded-full bg-white/90 shadow-sm backdrop-blur-md transition-all duration-200 hover:scale-105 active:scale-95",
        tone === "danger"
          ? "text-rose-600 hover:bg-rose-50"
          : "text-gray-600 hover:bg-brand-light-bg hover:text-brand-red",
      )}
    >
      {children}
    </button>
  );
}

function ActionButtons({
  inStock,
  onRemove,
  onMoveToCart,
  onShare,
}: {
  inStock: boolean;
  onRemove: () => void;
  onMoveToCart: () => void;
  onShare: () => void;
}) {
  const i18n = useInterfaceTranslations("InterfaceWishlistComponentsWishlistCard");
  return (
    <div className="flex max-w-full flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onShare}
        aria-label={i18n("Share")}
        className="grid h-11 w-11 place-items-center rounded-xl border border-brand-border bg-brand-white text-gray-600 transition-colors hover:border-brand-red hover:bg-brand-light-bg hover:text-brand-red"
      >
        <Share2 className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={i18n("Remove from wishlist")}
        className="grid h-11 w-11 place-items-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600 transition-colors hover:bg-rose-100"
      >
        <Heart className="h-4 w-4 fill-current" />
      </button>
      <button
        type="button"
        disabled={!inStock}
        onClick={onMoveToCart}
        className={cn(
          "inline-flex h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition-all duration-200",
          inStock
            ? "bg-brand-red text-brand-white shadow-sm hover:-translate-y-0.5 hover:bg-brand-red-hover hover:shadow-md"
            : "cursor-not-allowed bg-gray-100 text-gray-400",
        )}
      >
        <ShoppingCart className="h-4 w-4" />
        {inStock ? (
          <>
            <span className="min-[380px]:hidden">{i18n("Cart")}</span>
            <span className="hidden min-[380px]:inline">{i18n("Add to cart")}</span>
          </>
        ) : (
          i18n("Notify")
        )}
      </button>
    </div>
  );
}
