"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { Image as ImageIcon, Layers, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

type SummaryAccent = "violet" | "emerald" | "amber";

const ACCENT_STYLES: Record<SummaryAccent, string> = {
  violet: "bg-brand-light-bg text-brand-black",
  emerald: "bg-brand-light-bg text-brand-black",
  amber: "bg-brand-light-bg text-brand-black",
};

function SummaryCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: SummaryAccent;
}) {
  return (
    <div className="rounded-2xl border border-brand-border bg-brand-white p-4 shadow-sm">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {icon}
        {label}
      </p>
      <p
        className={cn(
          "mt-2 inline-flex rounded-xl px-3 py-1.5 text-sm font-bold",
          ACCENT_STYLES[accent],
        )}
      >
        {value}
      </p>
    </div>
  );
}

export default function BannerSummaryCards({
  totals,
}: {
  totals: {
    carousel: number;
    category: number;
    top: number;
    deal: number;
    promo: number;
    activeCarousel: number;
    activeCategory: number;
    activeTop: number;
    activeDeal: number;
    activePromo: number;
  };
}) {
  const i18n = useInterfaceTranslations("AdminAdminBannersComponentsBannerSummaryCards");
  return (
    <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
      <SummaryCard
        icon={<Layers className="h-4 w-4" />}
        label={i18n("Hero carousel")}
        value={`${totals.activeCarousel} / ${totals.carousel} active`}
        accent="violet"
      />
      <SummaryCard
        icon={<ImageIcon className="h-4 w-4" />}
        label={i18n("Category banners")}
        value={`${totals.activeCategory} / ${totals.category} active`}
        accent="emerald"
      />
      <SummaryCard
        icon={<Sparkles className="h-4 w-4" />}
        label={i18n("Top strip")}
        value={`${totals.activeTop} / ${totals.top} active`}
        accent="amber"
      />
      <SummaryCard
        icon={<Layers className="h-4 w-4" />}
        label={i18n("Product deals")}
        value={`${totals.activeDeal} / ${totals.deal} active`}
        accent="violet"
      />
      <SummaryCard
        icon={<ImageIcon className="h-4 w-4" />}
        label={i18n("Product promos")}
        value={`${totals.activePromo} / ${totals.promo} active`}
        accent="emerald"
      />
    </div>
  );
}
