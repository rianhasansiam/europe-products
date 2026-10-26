"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { Package } from "lucide-react";

import FormattedCurrencyAmount from "@/components/currency/FormattedCurrencyAmount";
import type { CheckoutItemPriced } from "@/features/checkout/api";
import type { CurrencyCode } from "@/lib/currency/config";
import ColorBadge from "@/components/ui/ColorBadge";
import { Skeleton } from "@/components/ui/loading";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1542838132-92c53300491e?w=400";

type CheckoutItemsCardProps = {
  items: CheckoutItemPriced[];
  currency: CurrencyCode;
  isLoading: boolean;
};

export default function CheckoutItemsCard({
  items,
  currency,
  isLoading,
}: CheckoutItemsCardProps) {
  const i18n = useInterfaceTranslations("InterfaceCheckoutComponentsCheckoutItemsCard");
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-muted text-foreground">
            <Package className="h-4 w-4" />
          </span>
          <h2 className="text-lg font-bold text-foreground">{i18n("Order items")}</h2>
        </div>
        <span className="text-xs text-muted-foreground">
          {items.length} {items.length === 1 ? i18n("product") : i18n("products")}
        </span>
      </header>

      {isLoading ? (
        <div className="space-y-3 rounded-2xl border border-dashed border-border bg-muted p-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3">
              <Skeleton className="h-16 w-16 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted p-6 text-center text-sm text-body">
          {i18n("No items selected.")}</div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item) => {
            const savings = item.lineSavings;
            return (
              <li
                key={item.variantId || item.productId}
                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.image || FALLBACK_IMAGE}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 break-words text-sm font-semibold text-foreground">
                    {item.name}
                  </p>
                  <ColorBadge
                    color={item.color}
                    size={item.size}
                    className="mt-0.5"
                  />
                  {(item.variantName || item.attributeSummary) && (
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                      {[item.variantName, item.attributeSummary]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {i18n("Qty")}{item.quantity} •{" "}
                    <FormattedCurrencyAmount
                      amount={item.unitPrice}
                      currency={currency}
                    />{" "}
                    {i18n("each")}</p>
                  {savings > 0 && (
                    <p className="mt-0.5 text-[11px] font-semibold text-success">
                      {i18n("You save")}{" "}
                      <FormattedCurrencyAmount
                        amount={savings}
                        currency={currency}
                      />
                    </p>
                  )}
                </div>
                <FormattedCurrencyAmount
                  amount={item.lineTotal}
                  currency={currency}
                  className="shrink-0 text-sm font-semibold text-foreground"
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
