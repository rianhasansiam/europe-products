"use client";
import { useLocale } from "next-intl";

import { useInterfaceTranslations } from "@/components/i18n/translate";


import Link from "@/lib/i18n/navigation";
import {
  Activity,
  ArrowRight,
  FolderTree,
  Inbox,
  ImageIcon,
  Mail,
  MessageSquareQuote,
  Package,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Star,
  User,
  UserPlus,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import type {
  DashboardActivity,
  DashboardActivityKind,
} from "@/features/admin-dashboard/api";
import { cn } from "@/lib/utils";

const KIND_META: Record<
  DashboardActivityKind,
  { icon: LucideIcon; tile: string }
> = {
  order: { icon: ShoppingBag, tile: "bg-brand-red/10 text-brand-red" },
  product: { icon: Package, tile: "bg-brand-red/10 text-brand-red" },
  category: { icon: FolderTree, tile: "bg-brand-red/10 text-brand-red" },
  banner: { icon: ImageIcon, tile: "bg-brand-red/10 text-brand-red" },
  message: { icon: Mail, tile: "bg-brand-red/10 text-brand-red" },
  review: { icon: Star, tile: "bg-brand-red/10 text-brand-red" },
  testimonial: {
    icon: MessageSquareQuote,
    tile: "bg-brand-red/10 text-brand-red",
  },
  settings: { icon: Settings, tile: "bg-brand-red/10 text-brand-red" },
  capital: { icon: Wallet, tile: "bg-brand-red/10 text-brand-red" },
  cost: { icon: Wallet, tile: "bg-brand-red/10 text-brand-red" },
  courier: { icon: ShieldCheck, tile: "bg-brand-red/10 text-brand-red" },
  user: { icon: UserPlus, tile: "bg-brand-red/10 text-brand-red" },
};

type ActivityFeedProps = {
  activity: DashboardActivity[];
  loading?: boolean;
};

export default function ActivityFeed({ activity, loading }: ActivityFeedProps) {
  const locale = useLocale();
  const i18n = useInterfaceTranslations("AdminAdminComponentsActivityFeed");
  return (
    <section className="rounded-2xl border border-brand-border bg-white p-4 shadow-sm sm:p-5">
      <header className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-brand-red" />
          <h2 className="text-sm font-bold text-gray-900">{i18n("Recent Activity")}</h2>
        </div>
        <Link
          href="/admin/activities"
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-brand-red transition-colors hover:bg-brand-red/10"
        >
          {i18n("View All")}<ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      {loading ? (
        <ol className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="flex gap-3">
              <div className="h-6 w-6 shrink-0 animate-pulse rounded-full bg-brand-light-bg" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-3/4 animate-pulse rounded bg-brand-light-bg" />
                <div className="h-2.5 w-1/3 animate-pulse rounded bg-brand-light-bg" />
              </div>
            </li>
          ))}
        </ol>
      ) : activity.length === 0 ? (
        <div className="grid place-items-center rounded-xl bg-brand-light-bg px-4 py-10 text-center">
          <Inbox className="h-7 w-7 text-brand-text-muted" />
          <p className="mt-2 text-sm font-semibold text-gray-700">
            {i18n("Nothing yet")}</p>
          <p className="mt-1 text-xs text-gray-500">
            {i18n("Recent admin, customer, and catalog activity will appear here.")}</p>
        </div>
      ) : (
        <ol className="relative space-y-4 border-s border-dashed border-brand-border ps-5">
          {activity.map((entry) => {
            const meta = KIND_META[entry.kind];
            const Icon = meta.icon;
            const performedBy = entry.performedBy?.trim();

            return (
              <li key={entry.id} className="relative">
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-[-26px] top-0 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white",
                    meta.tile,
                  )}
                >
                  <Icon className="h-3 w-3" />
                </span>
                <p className="text-sm text-gray-800">
                  <span className="font-semibold text-gray-900">
                    {entry.actor}
                  </span>{" "}
                  {entry.action}
                  {entry.target && (
                    <>
                      {" "}
                      {entry.href ? (
                        <Link
                          href={entry.href}
                          className="font-semibold text-brand-red hover:underline"
                        >
                          {entry.target}
                        </Link>
                      ) : (
                        <span className="font-semibold text-brand-red">
                          {entry.target}
                        </span>
                      )}
                    </>
                  )}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-gray-500">
                  <span>{formatRelative(entry.at, locale)}</span>
                  {performedBy && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span>{i18n("Performed by")}</span>
                        <span className="font-medium text-gray-700">
                          {performedBy}
                        </span>
                      </span>
                    </>
                  )}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function formatRelative(iso: string, locale = "en"): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;

  const diff = Date.now() - then;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "Just now";
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  try {
    return new Date(iso).toLocaleDateString(locale);
  } catch {
    return iso;
  }
}
