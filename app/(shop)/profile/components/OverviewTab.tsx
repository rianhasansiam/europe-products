"use client";
import { useLocale } from "next-intl";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import Link from "@/lib/i18n/navigation";
import {
  ArrowRight,
  ClipboardList,
  Gift,
  Heart,
  Package,
  ShoppingBag,
  Sparkles,
  Wallet,
} from "lucide-react";

import { FormattedCurrencyAmount } from "@/components/currency/FormattedCurrencyAmount";
import { BASE_CURRENCY } from "@/lib/currency/config";
import type { ProfileStats, ProfileUser } from "@/features/profile/api";
import { ORDER_STATUS_TONE } from "./constants";
import type { ProfileTabId } from "./constants";

type OverviewTabProps = {
  user: ProfileUser;
  stats: ProfileStats;
  onJumpToTab: (tabId: ProfileTabId) => void;
};

function formatDate(value: string | null, locale: string): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString(locale);
  } catch {
    return value;
  }
}

export default function OverviewTab({
  user,
  stats,
  onJumpToTab,
}: OverviewTabProps) {
  const locale = useLocale();
  const i18n = useInterfaceTranslations("InterfaceProfileComponentsOverviewTab");
  // Headline milestones for the overview widget (fits the 5-col grid).
  // The full per-status breakdown lives on the Orders tab.
  const ordered = (
    [
      "PENDING",
      "PAYMENT_CONFIRMED",
      "IN_TRANSIT",
      "DELIVERED",
      "CANCELLED",
    ] as const
  ).map((key) => ({
    key,
    count: stats.ordersByStatus[key] ?? 0,
  }));

  const incompleteProfile = !user.phone || !user.city;

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {/* Headline metrics */}
      <section className="grid grid-cols-1 gap-2 @xs:grid-cols-2 sm:gap-3 @3xl:grid-cols-4">
        <MetricCard
          icon={<Wallet className="h-4 w-4" />}
          label={i18n("Lifetime spend (USD orders)")}
          value={<FormattedCurrencyAmount amount={stats.totalSpend} currency={BASE_CURRENCY} />}
          tone="violet"
        />
        <MetricCard
          icon={<Package className="h-4 w-4" />}
          label={i18n("Total orders")}
          value={stats.totalOrders.toString()}
          tone="indigo"
        />
        <MetricCard
          icon={<ShoppingBag className="h-4 w-4" />}
          label={i18n("In your cart")}
          value={stats.cartCount.toString()}
          tone="fuchsia"
          actionLabel="Open cart"
          onAction={() => onJumpToTab("cart")}
        />
        <MetricCard
          icon={<Heart className="h-4 w-4" />}
          label={i18n("Wishlist")}
          value={stats.wishlistCount.toString()}
          tone="rose"
          actionLabel="Open wishlist"
          onAction={() => onJumpToTab("wishlist")}
        />
      </section>

      {incompleteProfile && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm sm:rounded-3xl sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-200 text-amber-900">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-amber-900">
                {i18n("Finish setting up your profile")}</h3>
              <p className="mt-0.5 text-xs text-amber-800">
                {i18n("Add your")}{" "}
                {[
                  !user.phone ? "phone number" : null,
                  !user.city ? "city" : null,
                ]
                  .filter(Boolean)
                  .join(" and ")}{" "}
                {i18n("so checkout is one click away.")}</p>
            </div>
            <button
              type="button"
              onClick={() => onJumpToTab("settings")}
              className="inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-xl bg-amber-900 px-3 py-2 text-xs font-bold text-amber-50 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-amber-950 sm:w-auto sm:py-1.5"
            >
              {i18n("Edit profile")}<ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
            </button>
          </div>
        </section>
      )}

      {/* Order status breakdown */}
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:rounded-3xl sm:p-6">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-background text-foreground">
              <ClipboardList className="h-4 w-4" />
            </span>
            <h2 className="text-base font-bold text-foreground sm:text-lg">
              {i18n("Order activity")}</h2>
          </div>
          <button
            type="button"
            onClick={() => onJumpToTab("orders")}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-hover"
          >
            {i18n("View all")}<ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
          </button>
        </header>

        <div className="grid grid-cols-1 gap-2 @xs:grid-cols-2 @lg:grid-cols-3 @3xl:grid-cols-5">
          {ordered.map(({ key, count }) => {
            const tone = ORDER_STATUS_TONE[key];
            return (
              <div
                key={key}
                className="rounded-2xl border border-border bg-card p-3"
              >
                <span
                  className={`inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold leading-tight ${tone.pill}`}
                >
                  {i18n(tone.label)}
                </span>
                <p className="mt-2 text-2xl font-bold text-foreground">
                  {count}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {count === 1 ? i18n("order") : i18n("orders")}
                </p>
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          {i18n("Last order placed:")}{" "}
          <span className="font-semibold text-body">
            {formatDate(stats.lastOrderAt, locale)}
          </span>
        </p>
      </section>

      {/* Quick actions */}
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:rounded-3xl sm:p-6">
        <header className="mb-4 flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-background text-foreground">
            <Gift className="h-4 w-4" />
          </span>
          <h2 className="text-base font-bold text-foreground sm:text-lg">
            {i18n("Quick actions")}</h2>
        </header>
        <div className="grid gap-3 @md:grid-cols-2 @2xl:grid-cols-3">
          <QuickAction
            label={i18n("Browse products")}
            description={i18n("Discover what's new in store.")}
            href="/products"
            icon={<ShoppingBag className="h-4 w-4" />}
          />
          <QuickAction
            label={i18n("Update profile")}
            description={i18n("Keep contact details current.")}
            onClick={() => onJumpToTab("settings")}
            icon={<Sparkles className="h-4 w-4" />}
          />
          <QuickAction
            label={i18n("Change password")}
            description={i18n("Rotate credentials regularly.")}
            onClick={() => onJumpToTab("security")}
            icon={<Heart className="h-4 w-4" />}
          />
        </div>
      </section>
    </div>
  );
}

const TONE_STYLES: Record<
  "violet" | "indigo" | "fuchsia" | "rose",
  { surface: string; iconBg: string; iconText: string }
> = {
  violet: {
    surface: "bg-background",
    iconBg: "bg-card",
    iconText: "text-foreground",
  },
  indigo: {
    surface: "bg-background",
    iconBg: "bg-card",
    iconText: "text-foreground",
  },
  fuchsia: {
    surface: "bg-background",
    iconBg: "bg-card",
    iconText: "text-foreground",
  },
  rose: {
    surface: "bg-background",
    iconBg: "bg-card",
    iconText: "text-foreground",
  },
};

function MetricCard({
  icon,
  label,
  value,
  tone,
  actionLabel,
  onAction,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tone: keyof typeof TONE_STYLES;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const i18n = useInterfaceTranslations("InterfaceProfileComponentsOverviewTab");
  const styles = TONE_STYLES[tone];
  return (
    <div
      className={`min-w-0 rounded-2xl border border-border ${styles.surface} p-3 shadow-sm sm:rounded-3xl sm:p-4`}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`grid h-8 w-8 place-items-center rounded-lg ${styles.iconBg} ${styles.iconText}`}
        >
          {icon}
        </span>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-primary hover:text-primary-hover"
          >
            {actionLabel}
            <ArrowRight className="h-3 w-3 rtl:rotate-180" />
          </button>
        )}
      </div>
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {i18n(label)}
      </p>
      <p className="mt-0.5 wrap-break-word text-xl font-bold text-foreground sm:text-2xl">
        {value}
      </p>
    </div>
  );
}

function QuickAction({
  label,
  description,
  href,
  onClick,
  icon,
}: {
  label: string;
  description: string;
  href?: string;
  onClick?: () => void;
  icon: React.ReactNode;
}) {
  const i18n = useInterfaceTranslations("InterfaceProfileComponentsOverviewTab");
  const className =
    "group flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 text-start transition-all duration-200 hover:-translate-y-0.5 hover:border-primary hover:shadow-md";

  const inner = (
    <>
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-background text-foreground">
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold text-foreground">
            {i18n(label)}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {i18n(description)}
          </span>
        </span>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary rtl:rotate-180" />
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {inner}
    </button>
  );
}
