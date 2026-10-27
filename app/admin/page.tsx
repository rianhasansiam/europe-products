"use client";
import { useLocale } from "next-intl";

import { useInterfaceTranslations } from "@/components/i18n/translate";


import { useCallback, useEffect, useState } from "react";
import { AlertCircle, RotateCw } from "lucide-react";

import {
  fetchDashboardOverview,
  type DashboardOverview,
} from "@/features/admin-dashboard/api";
import { LoadingSpinner } from "@/components/ui/loading";

import ActivityFeed from "./components/ActivityFeed";
import RecentOrders from "./components/RecentOrders";
import SalesChart from "./components/SalesChart";
import StatCards from "./components/StatCards";
import TopProducts from "./components/TopProducts";

type LoadState =
  | { status: "loading"; previous: DashboardOverview | null }
  | { status: "ready"; overview: DashboardOverview }
  | { status: "error"; message: string; previous: DashboardOverview | null };

/**
 * Admin dashboard.
 *
 * Single-fetch shell: hits `/api/admin/dashboard` on mount, hands the
 * payload to the presentational widgets below, and exposes a Refresh
 * button so the admin can pull fresh numbers without reloading the
 * whole shell. The previous payload stays on screen during a refresh
 * so the page never flashes empty between reads.
 */
export default function AdminDashboardPage() {
  const locale = useLocale();
  const i18n = useInterfaceTranslations("AdminAdminPage");
  const [state, setState] = useState<LoadState>({
    status: "loading",
    previous: null,
  });

  const load = useCallback(
    async (mode: "initial" | "refresh") => {
      await Promise.resolve();

      setState((current) => {
        const previous =
          current.status === "ready"
            ? current.overview
            : current.status === "loading"
              ? current.previous
              : current.previous;
        return { status: "loading", previous };
      });

      try {
        const overview = await fetchDashboardOverview();
        setState({ status: "ready", overview });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to load dashboard data.";
        setState((current) => ({
          status: "error",
          message,
          previous:
            current.status === "ready"
              ? current.overview
              : mode === "refresh"
                ? current.previous
                : null,
        }));
      }
    },
    [],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load("initial");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const overview =
    state.status === "ready"
      ? state.overview
      : state.status === "loading"
        ? state.previous
        : state.previous;

  const loading = state.status === "loading";
  const errorMessage = state.status === "error" ? state.message : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-extrabold text-gray-900 sm:text-xl">
            {i18n("Dashboard")}</h1>
          <p className="text-xs text-gray-500">
            {overview
              ? `Updated ${formatRelative(overview.generatedAt, locale)}`
              : i18n("Loading the latest numbers from your store...")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load("refresh")}
          disabled={loading}
          aria-busy={loading}
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-brand-border bg-white px-3 text-xs font-bold text-brand-red shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-red hover:bg-brand-light-bg disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {loading ? (
            <LoadingSpinner decorative size="sm" />
          ) : (
            <RotateCw className="h-3.5 w-3.5" />
          )}
          {loading ? i18n("Refreshing...") : i18n("Refresh")}
        </button>
      </div>

      {errorMessage && (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">{i18n("Couldn't refresh dashboard.")}</p>
            <p className="text-xs">{i18n(errorMessage)}</p>
          </div>
          <button
            type="button"
            onClick={() => void load("refresh")}
            className="rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100"
          >
            {i18n("Try again")}</button>
        </div>
      )}

      <p className="text-xs text-gray-500">{i18n("Sales totals include USD orders only.")}</p>

      <StatCards stats={overview?.stats ?? null} loading={loading && !overview} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <SalesChart
            sales={overview?.sales ?? null}
            loading={loading && !overview}
          />
        </div>
        <TopProducts
          products={overview?.topProducts ?? []}
          loading={loading && !overview}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RecentOrders
            orders={overview?.recentOrders ?? []}
            loading={loading && !overview}
          />
        </div>
        <ActivityFeed
          activity={overview?.activity ?? []}
          loading={loading && !overview}
        />
      </div>
    </div>
  );
}

function formatRelative(iso: string, locale = "en"): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;

  const diff = Date.now() - then;
  const minute = 60 * 1000;
  const hour = 60 * minute;

  if (diff < minute) return "just now";
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < 24 * hour) return `${Math.floor(diff / hour)}h ago`;
  try {
    return new Date(iso).toLocaleString(locale);
  } catch {
    return iso;
  }
}
