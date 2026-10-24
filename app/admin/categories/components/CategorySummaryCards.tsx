"use client";
import { useLocale } from "next-intl";

import { useInterfaceTranslations } from "@/components/i18n/translate";


import { Eye, FolderRoot, FolderTree, Package } from "lucide-react";

import { cn } from "@/lib/utils";

const CARDS = {
  roots: { icon: FolderRoot, label: "Root categories", style: "bg-violet-50 text-violet-700" },
  children: { icon: FolderTree, label: "Subcategories", style: "bg-sky-50 text-sky-700" },
  active: { icon: Eye, label: "Storefront visible", style: "bg-emerald-50 text-emerald-700" },
  products: { icon: Package, label: "Products mapped", style: "bg-amber-50 text-amber-700" },
} as const;

export default function CategorySummaryCards({
  roots,
  subcategories,
  active,
  productsMapped,
}: {
  roots: number;
  subcategories: number;
  active: number;
  productsMapped: number;
}) {
  const locale = useLocale();
  const i18n = useInterfaceTranslations("AdminAdminCategoriesComponentsCategorySummaryCards");
  const values = { roots, children: subcategories, active, products: productsMapped };
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {(Object.keys(CARDS) as Array<keyof typeof CARDS>).map((key) => {
        const config = CARDS[key];
        const Icon = config.icon;
        return (
          <div key={key} className="rounded-2xl border border-brand-border bg-brand-white p-4 shadow-sm">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <Icon className="h-4 w-4" />
              {i18n(config.label)}
            </p>
            <p className={cn("mt-2 inline-flex rounded-xl px-3 py-1.5 text-sm font-bold", config.style)}>
              {values[key].toLocaleString(locale)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
