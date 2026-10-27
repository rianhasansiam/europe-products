"use client";
import { useLocale } from "next-intl";

import { useInterfaceTranslations } from "@/components/i18n/translate";


import { cn } from "@/lib/utils";
import { formatCurrency } from "@/features/admin-orders/api";

type SummaryAccent = "violet" | "emerald" | "amber";

const ACCENT_STYLES: Record<SummaryAccent, string> = {
  violet: "bg-brand-light-bg text-foreground",
  emerald: "bg-brand-light-bg text-foreground",
  amber: "bg-amber-50 text-amber-700",
};

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: SummaryAccent;
}) {
  return (
    <div className="rounded-2xl border border-brand-border bg-brand-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
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

export default function OrderSummaryCards({
  totalOrders,
  sales,
  pending,
  unpaid,
}: {
  totalOrders: number;
  sales: number;
  pending: number;
  unpaid: number;
}) {
  const locale = useLocale();
  const i18n = useInterfaceTranslations("AdminAdminOrdersComponentsOrderSummaryCards");
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <SummaryCard
        label={i18n("Total orders")}
        value={totalOrders.toLocaleString(locale)}
        accent="violet"
      />
      <SummaryCard
        label={i18n("Sales (excl. cancelled)")}
        value={formatCurrency(sales, locale)}
        accent="emerald"
      />
      <SummaryCard
        label={i18n("Pending / unpaid")}
        value={`${pending} pending · ${unpaid} unpaid`}
        accent="amber"
      />
    </div>
  );
}
