"use client";
import { useLocale } from "next-intl";

import { useInterfaceTranslations } from "@/components/i18n/translate";


import { ShieldCheck, UserRound, Users } from "lucide-react";

import { formatCurrency } from "@/features/admin-users/api";
import { cn } from "@/lib/utils";

type SummaryAccent = "violet" | "emerald" | "amber";

const ACCENT_STYLES: Record<SummaryAccent, string> = {
  violet: "bg-brand-light-bg text-brand-black",
  emerald: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
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

export default function UserSummaryCards({
  totalCustomers,
  admins,
  guests,
  withOrders,
  lifetimeRevenue,
}: {
  totalCustomers: number;
  admins: number;
  guests: number;
  withOrders: number;
  lifetimeRevenue: number;
}) {
  const locale = useLocale();
  const i18n = useInterfaceTranslations("AdminAdminUsersComponentsUserSummaryCards");
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard
        icon={<Users className="h-4 w-4" />}
        label={i18n("Total customers")}
        value={totalCustomers.toLocaleString(locale)}
        accent="violet"
      />
      <SummaryCard
        icon={<UserRound className="h-4 w-4" />}
        label={i18n("Guest customers")}
        value={guests.toLocaleString(locale)}
        accent="violet"
      />
      <SummaryCard
        icon={<ShieldCheck className="h-4 w-4" />}
        label={i18n("Admins")}
        value={admins.toLocaleString(locale)}
        accent="emerald"
      />
      <SummaryCard
        icon={<UserRound className="h-4 w-4" />}
        label={i18n("With orders")}
        value={`${withOrders} · ${formatCurrency(lifetimeRevenue, locale)}`}
        accent="amber"
      />
    </div>
  );
}
