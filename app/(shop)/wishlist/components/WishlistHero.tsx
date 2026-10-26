
import { useInterfaceTranslations } from "@/components/i18n/translate";
import { Heart, Sparkles, TrendingDown, BadgePercent } from "lucide-react";

import { CurrencyAmount } from "@/components/currency/CurrencyAmount";

type WishlistHeroProps = {
  totalItems: number;
  totalValue: number;
  totalSavings: number;
  priceDrops: number;
};

export default function WishlistHero({
  totalItems,
  totalValue,
  totalSavings,
  priceDrops,
}: WishlistHeroProps) {
  const i18n = useInterfaceTranslations("InterfaceWishlistComponentsWishlistHero");
  return (
    <section className="relative hidden overflow-hidden rounded-3xl border border-border bg-secondary px-6 py-8 text-foreground shadow-sm sm:block sm:px-10 sm:py-10">
      <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium ">
            <Sparkles className="h-3.5 w-3.5" />
            {i18n("Curated by you")}</div>
          <h1 className="mt-4 flex items-center gap-3 text-3xl font-bold tracking-tight sm:text-4xl">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-card  ring-1 ring-border">
              <Heart className="h-6 w-6 fill-primary text-primary" />
            </span>
            {i18n("Your Wishlist")}</h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-body sm:text-base">
            {i18n("Everything you're dreaming about, in one place. We'll quietly watch prices and ping you when something drops.")}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:gap-4">
          <HeroStat
            label={i18n("Items")}
            value={totalItems.toString()}
            icon={<Heart className="h-4 w-4" />}
          />
          <HeroStat
            label={i18n("Total value")}
            value={<CurrencyAmount amountUSD={totalValue} />}
            icon={<BadgePercent className="h-4 w-4" />}
          />
          <HeroStat
            label={i18n("Price drops")}
            value={priceDrops.toString()}
            icon={<TrendingDown className="h-4 w-4" />}
            highlight={priceDrops > 0}
          />
          {totalSavings > 0 && (
            <div className="col-span-2 sm:col-span-3">
              <div className="rounded-2xl border border-border bg-card px-4 py-3 ">
                <p className="text-xs font-medium text-muted-foreground">
                  {i18n("You'd save")}</p>
                <p className="text-lg font-bold sm:text-xl">
                  <CurrencyAmount amountUSD={totalSavings} />{" "}
                  <span className="text-xs font-medium text-muted-foreground">
                    {i18n("if you bought everything today")}</span>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function HeroStat({
  label,
  value,
  icon,
  highlight = false,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  const i18n = useInterfaceTranslations("InterfaceWishlistComponentsWishlistHero");
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-border bg-card px-4 py-3   ${
        highlight ? "ring-2 ring-emerald-300/70" : ""
      }`}
    >
      <div className="flex items-center gap-2 text-body">
        {icon}
        <span className="text-xs font-medium">{i18n(label)}</span>
      </div>
      <p className="mt-1 truncate text-base font-bold sm:text-lg">{value}</p>
      {highlight && (
        <span className="absolute end-2 top-2 inline-flex h-2 w-2 rounded-full bg-success" />
      )}
    </div>
  );
}
