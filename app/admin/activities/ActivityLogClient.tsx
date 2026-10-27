"use client";
import { useLocale } from "next-intl";

import { useInterfaceTranslations } from "@/components/i18n/translate";


import Link from "@/lib/i18n/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FolderTree,
  ImageIcon,
  Inbox,
  Mail,
  MessageSquareQuote,
  Package,
  RotateCcw,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Star,
  User,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

import {
  activityPerformer,
  fetchAdminActivities,
  type AdminActivityActorOption,
  type AdminActivityItem,
  type AdminActivityKind,
  type AdminActivityPage,
  type AdminActivitySource,
} from "@/features/admin-activities/api";
import { LoadingSpinner } from "@/components/ui/loading";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

const KIND_META: Record<
  AdminActivityKind,
  { label: string; icon: LucideIcon }
> = {
  order: { label: "Order", icon: ShoppingBag },
  product: { label: "Product", icon: Package },
  category: { label: "Category", icon: FolderTree },
  banner: { label: "Banner", icon: ImageIcon },
  message: { label: "Message", icon: Mail },
  review: { label: "Review", icon: Star },
  testimonial: { label: "Testimonial", icon: MessageSquareQuote },
  settings: { label: "Settings", icon: Settings },
  courier: { label: "Courier", icon: ShieldCheck },
  user: { label: "Customer", icon: UserPlus },
};

const MODULE_OPTIONS = (
  Object.keys(KIND_META) as AdminActivityKind[]
).map((kind) => ({ value: kind, label: KIND_META[kind].label }));

const SOURCE_META: Record<AdminActivitySource, { label: string }> = {
  admin: { label: "Admin Activity Log" },
  order: { label: "Order Placement" },
  "order-status": { label: "Order Status" },
  user: { label: "Customer Account" },
  message: { label: "Contact Message" },
};

const SOURCE_OPTIONS = (
  Object.keys(SOURCE_META) as AdminActivitySource[]
).map((source) => ({ value: source, label: SOURCE_META[source].label }));

const inputClass =
  "h-10 rounded-xl border border-brand-border px-3 text-sm outline-none transition focus:border-brand-red";

type Filters = {
  search: string;
  kind: AdminActivityKind | "";
  source: AdminActivitySource | "";
  actorId: string;
  from: string;
  to: string;
};

const EMPTY_FILTERS: Filters = {
  search: "",
  kind: "",
  source: "",
  actorId: "",
  from: "",
  to: "",
};

export default function ActivityLogClient() {
  const i18n = useInterfaceTranslations("AdminAdminActivitiesActivityLogClient");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminActivityPage | null>(null);
  const [actors, setActors] = useState<AdminActivityActorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAdminActivities({
        page,
        limit: PAGE_SIZE,
        kind: filters.kind,
        source: filters.source,
        actorId: filters.actorId,
        search: filters.search,
        from: filters.from,
        to: filters.to,
      });
      setData(result);
      // The actor list is stable across pages; keep the first non-empty
      // set so the dropdown doesn't flicker on filtered reads.
      if (result.actors.length > 0) setActors(result.actors);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load activity log.",
      );
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 300);
    return () => window.clearTimeout(timer);
  }, [load]);

  const updateFilter = useCallback(
    <K extends keyof Filters>(key: K, value: Filters[K]) => {
      setFilters((current) => ({ ...current, [key]: value }));
      setPage(1);
    },
    [],
  );

  const resetFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  }, []);

  const hasFilters = useMemo(
    () =>
      filters.search !== "" ||
      filters.kind !== "" ||
      filters.source !== "" ||
      filters.actorId !== "" ||
      filters.from !== "" ||
      filters.to !== "",
    [filters],
  );

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const hasPrevPage = data?.hasPrevPage ?? page > 1;
  const hasNextPage = data?.hasNextPage ?? page < totalPages;
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-extrabold text-gray-900 sm:text-xl">
            <Activity className="h-5 w-5 text-brand-red" />
            {i18n("Activity Log")}</h1>
          <p className="text-xs text-gray-500">
            {i18n("Audit history for admin, order, customer, and message activity.")}</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          aria-busy={loading}
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-brand-border bg-white px-3 text-xs font-bold text-brand-red shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-red hover:bg-brand-light-bg disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {loading ? (
            <LoadingSpinner decorative size="sm" />
          ) : (
            <RotateCcw className="h-3.5 w-3.5" />
          )}
          {loading ? i18n("Refreshing...") : i18n("Refresh")}
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <input
            type="text"
            value={filters.search}
            onChange={(event) => updateFilter("search", event.target.value)}
            placeholder={i18n("Search action, source, target, ID, or performer...")}
            className={cn(inputClass, "w-full lg:flex-1")}
          />

          <select
            value={filters.kind}
            onChange={(event) =>
              updateFilter("kind", event.target.value as Filters["kind"])
            }
            className={inputClass}
          >
            <option value="">{i18n("All Modules")}</option>
            {MODULE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {i18n(option.label)}
              </option>
            ))}
          </select>

          <select
            value={filters.source}
            onChange={(event) =>
              updateFilter("source", event.target.value as Filters["source"])
            }
            className={inputClass}
          >
            <option value="">{i18n("All Sources")}</option>
            {SOURCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {i18n(option.label)}
              </option>
            ))}
          </select>

          <select
            value={filters.actorId}
            onChange={(event) => updateFilter("actorId", event.target.value)}
            className={inputClass}
          >
            <option value="">{i18n("All Performers")}</option>
            {actors.map((actor) => (
              <option key={actor.id} value={actor.id}>
                {actor.name || actor.email || "Unknown"}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 text-xs font-semibold text-gray-600">
            {i18n("From")}<input
              type="date"
              value={filters.from}
              max={filters.to || undefined}
              onChange={(event) => updateFilter("from", event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-gray-600">
            {i18n("To")}<input
              type="date"
              value={filters.to}
              min={filters.from || undefined}
              onChange={(event) => updateFilter("to", event.target.value)}
              className={inputClass}
            />
          </label>
          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-brand-border px-3 text-sm font-semibold text-gray-700 transition hover:bg-brand-light-bg"
            >
              <RotateCcw className="h-4 w-4" />
              {i18n("Reset")}</button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">{i18n("Couldn't load activity log.")}</p>
            <p className="text-xs">{i18n(error)}</p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100"
          >
            {i18n("Try again")}</button>
        </div>
      )}

      <ActivityTable items={items} loading={loading && !data} />

      {/* Pagination */}
      {total > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-xs text-gray-500">
            {i18n("Showing")}{" "}<span className="font-semibold">{rangeStart}</span>-
            <span className="font-semibold">{rangeEnd}</span> {i18n("of")}{" "}
            <span className="font-semibold">{total}</span> {i18n("All Activities")}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={!hasPrevPage || loading}
              className="inline-flex h-9 items-center gap-1 rounded-xl border border-brand-border bg-white px-3 text-xs font-bold text-gray-700 transition hover:bg-brand-light-bg disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
              {i18n("Previous")}</button>
            <span className="text-xs font-semibold text-gray-600">
              {i18n("Page")}{" "}{page} {i18n("of")}{" "}{totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={!hasNextPage || loading}
              className="inline-flex h-9 items-center gap-1 rounded-xl border border-brand-border bg-white px-3 text-xs font-bold text-gray-700 transition hover:bg-brand-light-bg disabled:cursor-not-allowed disabled:opacity-50"
            >
              {i18n("Next")}<ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Table                                                                     */
/* -------------------------------------------------------------------------- */

function ActivityTable({
  items,
  loading,
}: {
  items: AdminActivityItem[];
  loading: boolean;
}) {
  const locale = useLocale();
  const i18n = useInterfaceTranslations("AdminAdminActivitiesActivityLogClient");
  if (loading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-brand-border bg-white shadow-sm">
        <ul className="divide-y divide-brand-border">
          {Array.from({ length: 8 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3 p-4">
              <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-brand-light-bg" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-2/3 animate-pulse rounded bg-brand-light-bg" />
                <div className="h-2.5 w-1/3 animate-pulse rounded bg-brand-light-bg" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border border-brand-border bg-white px-4 py-16 text-center shadow-sm">
        <Inbox className="h-8 w-8 text-brand-text-muted" />
        <p className="mt-2 text-sm font-semibold text-gray-700">
          {i18n("No activities found")}</p>
        <p className="mt-1 text-xs text-gray-500">
          {i18n("Admin actions across the panel will appear here.")}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-border bg-white shadow-sm">
      {/* Desktop / tablet table */}
      <table className="hidden w-full text-start text-sm sm:table">
        <thead className="border-b border-brand-border bg-brand-light-bg/60 text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3 font-semibold">{i18n("Activity Details")}</th>
            <th className="px-4 py-3 font-semibold">{i18n("Source")}</th>
            <th className="px-4 py-3 font-semibold">{i18n("Module")}</th>
            <th className="px-4 py-3 font-semibold">{i18n("Performed by")}</th>
            <th className="px-4 py-3 text-end font-semibold">{i18n("Date & time")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-border">
          {items.map((item) => {
            const meta = KIND_META[item.kind];
            const Icon = meta.icon;
            return (
              <tr key={item.id} className="align-top hover:bg-brand-light-bg/40">
                <td className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-red/10 text-brand-red">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 space-y-1">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                          {i18n("Action")}</p>
                        <p className="font-semibold text-gray-900">
                          {capitalizeFirst(item.action)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                          {i18n("Target")}</p>
                        <ActivityTarget item={item} />
                      </div>
                      {item.targetId && (
                        <p className="text-xs text-gray-500">
                          {i18n("Target ID")}{" "}
                          <code className="rounded bg-brand-light-bg px-1.5 py-0.5 font-mono text-[11px] text-gray-700">
                            {item.targetId}
                          </code>
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 ring-1 ring-brand-border">
                    {sourceLabel(item.source)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-full bg-brand-light-bg px-2.5 py-1 text-xs font-semibold text-gray-700">
                    {meta.label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 text-gray-800">
                    <User className="h-3.5 w-3.5 text-brand-text-muted" />
                    {activityPerformer(item)}
                  </span>
                </td>
                <td className="px-4 py-3 text-end text-xs text-gray-500">
                  {formatDateTime(item.createdAt, locale)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Mobile cards */}
      <ul className="divide-y divide-brand-border sm:hidden">
        {items.map((item) => {
          const meta = KIND_META[item.kind];
          const Icon = meta.icon;
          return (
            <li key={item.id} className="flex gap-3 p-4">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-red/10 text-brand-red">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  {i18n("Activity Details")}</p>
                <p className="text-sm font-semibold text-gray-900">
                  {capitalizeFirst(item.action)}
                </p>
                <ActivityTarget item={item} />
                {item.targetId && (
                  <p className="mt-1 text-xs text-gray-500">
                    {i18n("Target ID")}{" "}
                    <code className="rounded bg-brand-light-bg px-1.5 py-0.5 font-mono text-[11px] text-gray-700">
                      {item.targetId}
                    </code>
                  </p>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-500">
                  <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 font-semibold text-gray-600 ring-1 ring-brand-border">
                    {i18n("Source:")}{" "}{sourceLabel(item.source)}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-brand-light-bg px-2 py-0.5 font-semibold text-gray-600">
                    {i18n("Module:")}{" "}{meta.label}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span>{i18n("Performed by")}</span>
                    {activityPerformer(item)}
                  </span>
                  <span aria-hidden>|</span>
                  <span>{formatDateTime(item.createdAt, locale)}</span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ActivityTarget({ item }: { item: AdminActivityItem }) {
  const label = item.target?.trim() || "No target recorded";

  if (!item.href) {
    return <p className="break-words text-sm text-gray-800">{label}</p>;
  }

  return (
    <Link
      href={item.href}
      className="inline-flex max-w-full items-center gap-1 break-words text-sm font-semibold text-brand-red hover:underline"
    >
      <span>{label}</span>
      <ExternalLink className="h-3 w-3 shrink-0" />
    </Link>
  );
}

function sourceLabel(source: AdminActivitySource): string {
  return SOURCE_META[source].label;
}

function capitalizeFirst(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDateTime(iso: string, locale = "en"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  try {
    return date.toLocaleString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
