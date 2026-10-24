"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { cn } from "@/lib/utils";
import type { ProfileStats } from "@/features/profile/api";

import { PROFILE_TABS, type ProfileTabId } from "./constants";

type ProfileSidebarProps = {
  activeTab: ProfileTabId;
  onTabChange: (tabId: ProfileTabId) => void;
  stats: ProfileStats;
};

/**
 * Side rail of tabs on the profile dashboard.
 *
 * On mobile we collapse to a horizontal scroller so the rail doesn't
 * eat half the screen. The badge counts (orders / wishlist / cart)
 * come straight from the overview payload so they stay in sync with
 * the hero stats.
 */
export default function ProfileSidebar({
  activeTab,
  onTabChange,
  stats,
}: ProfileSidebarProps) {
  const i18n = useInterfaceTranslations("InterfaceProfileComponentsProfileSidebar");
  return (
    <aside className="min-w-0 lg:sticky lg:top-[88px] lg:self-start">
      {/* Mobile: horizontal scroller */}
      <nav
        className="-mx-3 flex snap-x gap-2 overflow-x-auto px-3 pb-1 scrollbar-none [&::-webkit-scrollbar]:hidden sm:-mx-6 sm:px-6 lg:hidden"
        aria-label={i18n("Profile sections")}
      >
        {PROFILE_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "inline-flex shrink-0 snap-start items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all duration-200 sm:gap-2 sm:text-sm",
                active
                  ? "border-brand-red bg-brand-light-bg text-brand-red shadow-sm"
                  : "border-brand-border bg-brand-white text-foreground hover:border-brand-red hover:text-brand-red",
              )}
              aria-pressed={active}
            >
              <Icon className="h-4 w-4" />
              {i18n(tab.label)}
              <Badge tabId={tab.id} stats={stats} />
            </button>
          );
        })}
      </nav>

      {/* Desktop: vertical rail */}
      <ul className="hidden flex-col gap-1.5 rounded-3xl border border-brand-border bg-brand-white p-3 shadow-sm lg:flex">
        {PROFILE_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = tab.id === activeTab;
          return (
            <li key={tab.id}>
              <button
                type="button"
                onClick={() => onTabChange(tab.id)}
                aria-pressed={active}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-start transition-all duration-200",
                  active
                    ? "bg-brand-red text-brand-white shadow-md"
                    : "text-foreground hover:bg-brand-light-bg hover:text-brand-red",
                )}
              >
                <span
                  className={cn(
                    "grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors",
                    active
                      ? "bg-white/20 text-white"
                      : "bg-brand-light-bg text-brand-black group-hover:bg-brand-border",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-bold">
                      {i18n(tab.label)}
                    </span>
                    <Badge tabId={tab.id} stats={stats} active={active} />
                  </span>
                  <span
                    className={cn(
                      "mt-0.5 block truncate text-[11px]",
                      active ? "text-white/85" : "text-gray-500",
                    )}
                  >
                    {i18n(tab.description)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

function Badge({
  tabId,
  stats,
  active,
}: {
  tabId: ProfileTabId;
  stats: ProfileStats;
  active?: boolean;
}) {
  let value: number | null = null;

  if (tabId === "orders") value = stats.totalOrders;
  else if (tabId === "wishlist") value = stats.wishlistCount;
  else if (tabId === "cart") value = stats.cartCount;

  if (value === null || value <= 0) return null;

  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold",
        active
          ? "bg-white/25 text-white"
          : "bg-brand-light-bg text-brand-black",
      )}
    >
      {value > 99 ? "99+" : value}
    </span>
  );
}
