"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import {
  BarChart3,
  Boxes,
  FolderTree,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { REPORT_DEFS, type ReportType } from "@/features/admin-reports/api";
import { cn } from "@/lib/utils";

const ICONS: Record<ReportType, LucideIcon> = {
  sales: BarChart3,
  orders: ShoppingBag,
  products: Sparkles,
  profit: TrendingUp,
  inventory: Boxes,
  customers: Users,
  categories: FolderTree,
};

const TYPE_ORDER: ReportType[] = [
  "sales",
  "orders",
  "products",
  "profit",
  "inventory",
  "customers",
  "categories",
];

type Props = {
  value: ReportType;
  onChange: (type: ReportType) => void;
  disabled?: boolean;
};

/**
 * Card grid the admin uses to choose which report to generate.
 * The active card is highlighted with the brand red accent
 * to match the rest of the admin console.
 */
export default function ReportTypePicker({ value, onChange, disabled }: Props) {
  const i18n = useInterfaceTranslations("AdminAdminReportsComponentsReportTypePicker");
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {TYPE_ORDER.map((type) => {
        const def = REPORT_DEFS[type];
        const Icon = ICONS[type];
        const active = value === type;

        return (
          <button
            key={type}
            type="button"
            disabled={disabled}
            onClick={() => onChange(type)}
            className={cn(
              "group relative overflow-hidden rounded-2xl border p-4 text-start transition-all duration-200",
              "shadow-sm hover:-translate-y-0.5 hover:shadow-md",
              active
                ? "border-brand-red bg-brand-light-bg"
                : "border-brand-border bg-white hover:border-brand-red",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl",
                  active
                    ? "bg-brand-red text-white"
                    : "bg-brand-light-bg text-brand-black",
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-gray-900">{i18n(def.label)}</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {i18n(def.description)}
                </p>
              </div>
            </div>

            {active && (
              <span className="absolute right-3 top-3 rounded-full bg-brand-red px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                {i18n("Selected")}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
