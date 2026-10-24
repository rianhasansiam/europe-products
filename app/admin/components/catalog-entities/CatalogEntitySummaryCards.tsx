"use client";
import { useLocale } from "next-intl";

import { useInterfaceTranslations } from "@/components/i18n/translate";


import { Eye, Package, Tags } from "lucide-react";

export default function CatalogEntitySummaryCards({
  pluralLabel,
  total,
  active,
  productsMapped,
}: {
  pluralLabel: string;
  total: number;
  active: number;
  productsMapped: number;
}) {
  const locale = useLocale();
  const i18n = useInterfaceTranslations("AdminAdminComponentsCatalogEntitiesCatalogEntitySummaryCards");
  const cards = [
    {
      label: `Total ${pluralLabel}`,
      value: total,
      icon: Tags,
      style: "bg-brand-light-bg text-brand-black",
    },
    {
      label: i18n("Active"),
      value: active,
      icon: Eye,
      style: "bg-emerald-50 text-emerald-700",
    },
    {
      label: i18n("Products mapped"),
      value: productsMapped,
      icon: Package,
      style: "bg-amber-50 text-amber-700",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="rounded-2xl border border-brand-border bg-brand-white p-4 shadow-sm"
          >
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <Icon className="h-4 w-4" />
              {i18n(card.label)}
            </p>
            <p
              className={`mt-2 inline-flex rounded-xl px-3 py-1.5 text-sm font-bold ${card.style}`}
            >
              {card.value.toLocaleString(locale)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
