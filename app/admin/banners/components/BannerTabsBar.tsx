"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { Plus, RotateCcw } from "lucide-react";

import type { BannerKind } from "@/features/admin-banners/api";
import { cn } from "@/lib/utils";

import { TABS } from "./constants";

export default function BannerTabsBar({
  activeTab,
  onTabChange,
  onRefresh,
  onCreate,
}: {
  activeTab: BannerKind;
  onTabChange: (tab: BannerKind) => void;
  onRefresh: () => void;
  onCreate: () => void;
}) {
  const i18n = useInterfaceTranslations("AdminAdminBannersComponentsBannerTabsBar");
  return (
    <div className="rounded-2xl border border-brand-border bg-brand-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {TABS.map((tab) => {
            const isActive = tab.kind === activeTab;
            return (
              <button
                key={tab.kind}
                type="button"
                onClick={() => onTabChange(tab.kind)}
                className={cn(
                  "rounded-xl border px-3 py-2 text-sm font-semibold transition",
                  isActive
                    ? "border-brand-red bg-brand-red text-white shadow"
                    : "border-brand-border text-foreground hover:bg-brand-light-bg",
                )}
              >
                {i18n(tab.label)}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-brand-border px-3 text-sm font-semibold text-foreground transition hover:bg-brand-light-bg"
          >
            <RotateCcw className="h-4 w-4" />
            {i18n("Refresh")}</button>

          <button
            type="button"
            onClick={onCreate}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-red px-4 text-sm font-semibold text-white transition hover:bg-brand-red-hover"
          >
            <Plus className="h-4 w-4" />
            {i18n("New")}{" "}{TABS.find((t) => t.kind === activeTab)?.label.toLowerCase()}
          </button>
        </div>
      </div>

      <p className="mt-3 text-xs text-gray-500">
        {TABS.find((t) => t.kind === activeTab)?.description}
      </p>
    </div>
  );
}
