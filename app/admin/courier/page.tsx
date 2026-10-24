"use client";
import { useLocale } from "next-intl";

import { useInterfaceTranslations } from "@/components/i18n/translate";


import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Package2,
  RotateCcw,
  Search,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { useDispatch, useSelector } from "react-redux";

import {
  setAdminOrders,
  setAdminOrdersError,
  setAdminOrdersLoading,
} from "@/store/slices/admin-orders.slice";
import type { AppDispatch, RootState } from "@/store";
import {
  fetchAllAdminOrdersSnapshot,
  formatDateTime,
} from "@/features/admin-orders/api";
import {
  checkCourierInfo,
  type CourierReport,
} from "@/features/admin-courier/api";
import {
  ButtonLoader,
  LoadingSpinner,
  SectionLoader,
  TableSkeleton,
} from "@/components/ui/loading";
import { cn } from "@/lib/utils";
import CourierReportPanel from "./components/CourierReportPanel";

export default function AdminCourierPage() {
  const locale = useLocale();
  const i18n = useInterfaceTranslations("AdminAdminCourierPage");
  const dispatch = useDispatch<AppDispatch>();
  const orders = useSelector((state: RootState) => state.adminOrders.items);
  const ordersLoading = useSelector(
    (state: RootState) => state.adminOrders.isLoading,
  );
  const ordersHydrated = useSelector(
    (state: RootState) => state.adminOrders.isHydrated,
  );
  const ordersError = useSelector(
    (state: RootState) => state.adminOrders.error,
  );

  const [orderQuery, setOrderQuery] = useState("");
  const [manualPhone, setManualPhone] = useState("");

  const [report, setReport] = useState<CourierReport | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [activePhone, setActivePhone] = useState<string | null>(null);

  const refreshOrders = useCallback(async () => {
    dispatch(setAdminOrdersLoading(true));
    dispatch(setAdminOrdersError(null));
    try {
      const items = await fetchAllAdminOrdersSnapshot();
      dispatch(setAdminOrders(items));
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Failed to load orders.";
      dispatch(setAdminOrdersError(message));
    } finally {
      dispatch(setAdminOrdersLoading(false));
    }
  }, [dispatch]);

  useEffect(() => {
    if (ordersHydrated) return;
    void refreshOrders();
  }, [ordersHydrated, refreshOrders]);

  const runCheck = useCallback(async (phone: string) => {
    const trimmed = phone.trim();
    if (!trimmed) return;
    setChecking(true);
    setCheckError(null);
    setActivePhone(trimmed);
    try {
      const result = await checkCourierInfo(trimmed);
      setReport(result);
    } catch (error) {
      setReport(null);
      setCheckError(
        error instanceof Error ? error.message : "Failed to check courier info.",
      );
    } finally {
      setChecking(false);
    }
  }, []);

  // De-duplicate the order list down to one row per customer phone so the
  // admin sees each customer once, with their most recent order summarised.
  const customers = useMemo(() => {
    const q = orderQuery.trim().toLowerCase();
    const byPhone = new Map<
      string,
      {
        phone: string;
        name: string;
        ordersCount: number;
        lastOrderAt: string;
        lastOrderNumber: string;
      }
    >();

    for (const order of orders) {
      const phone = order.customerPhone.trim();
      if (!phone) continue;
      const existing = byPhone.get(phone);
      if (existing) {
        existing.ordersCount += 1;
        if (order.createdAt > existing.lastOrderAt) {
          existing.lastOrderAt = order.createdAt;
          existing.lastOrderNumber = order.orderNumber;
          existing.name = order.customerName;
        }
      } else {
        byPhone.set(phone, {
          phone,
          name: order.customerName,
          ordersCount: 1,
          lastOrderAt: order.createdAt,
          lastOrderNumber: order.orderNumber,
        });
      }
    }

    const list = Array.from(byPhone.values()).sort((a, b) =>
      a.lastOrderAt < b.lastOrderAt ? 1 : -1,
    );

    if (!q) return list;
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.lastOrderNumber.toLowerCase().includes(q),
    );
  }, [orders, orderQuery]);

  return (
    <section className="space-y-4">
      {/* Heading */}
      <div className="rounded-2xl border border-brand-border bg-brand-black p-5 text-white shadow-sm">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/30">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-bold">{i18n("Courier Fraud Check")}</h1>
            <p className="text-xs text-white/70">
              {i18n("Review a customer's delivery track record before dispatching an order.")}</p>
          </div>
        </div>
      </div>

      {/* Manual search */}
      <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-sm sm:p-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          {i18n("Manual lookup")}</p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void runCheck(manualPhone);
          }}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <label className="relative flex flex-1 items-center">
            <Truck className="pointer-events-none absolute left-3 h-4 w-4 text-brand-text-muted" />
            <input
              type="tel"
              inputMode="tel"
              value={manualPhone}
              onChange={(event) => setManualPhone(event.target.value)}
              placeholder={i18n("Enter customer phone, e.g. 017XXXXXXXX")}
              className="h-10 w-full rounded-xl border border-brand-border ps-9 pe-3 text-sm outline-none transition focus:border-brand-red"
            />
          </label>
          <button
            type="submit"
            disabled={checking || !manualPhone.trim()}
            aria-busy={checking}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-brand-red px-5 text-sm font-semibold text-white transition hover:bg-brand-red-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {checking ? (
              <ButtonLoader label={i18n("Checking...")} />
            ) : (
              <>
                <Search className="h-4 w-4" />
                {i18n("Check")}</>
            )}
          </button>
        </form>
      </div>

      {checkError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {checkError}
        </div>
      )}

      {/* Report */}
      {checking && !report ? (
        <SectionLoader
          title={`Checking courier history${activePhone ? ` for ${activePhone}` : ""}`}
          rows={4}
        />
      ) : report ? (
        <CourierReportPanel report={report} />
      ) : null}

      {/* Customer / order list */}
      <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {i18n("Order history")}</p>
            <p className="text-sm text-gray-600">
              {i18n("Click a customer to check their courier record.")}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              void refreshOrders();
            }}
            disabled={ordersLoading}
            aria-busy={ordersLoading}
            className="inline-flex h-9 items-center gap-2 self-start rounded-xl border border-brand-border px-3 text-sm font-semibold text-brand-black transition hover:bg-brand-light-bg sm:self-auto"
          >
            {ordersLoading ? (
              <LoadingSpinner decorative size="sm" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            {ordersLoading ? i18n("Refreshing...") : i18n("Refresh")}
          </button>
        </div>

        <label className="relative mt-3 flex items-center">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-brand-text-muted" />
          <input
            type="text"
            value={orderQuery}
            onChange={(event) => setOrderQuery(event.target.value)}
            placeholder={i18n("Search customers by name, phone, or order #...")}
            className="h-10 w-full rounded-xl border border-brand-border ps-9 pe-3 text-sm outline-none transition focus:border-brand-red"
          />
        </label>

        {ordersError && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {ordersError}
          </div>
        )}

        <div className="mt-3 overflow-hidden rounded-xl border border-brand-border">
          {ordersLoading && orders.length === 0 ? (
            <TableSkeleton rows={6} columns={5} ariaLabel="Loading orders" />
          ) : customers.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-600">
              <Package2 className="mx-auto mb-2 h-8 w-8 text-brand-text-muted" />
              {i18n("No customers match the current search.")}</div>
          ) : (
            <div className="max-h-112 overflow-x-auto overflow-y-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-brand-light-bg text-start text-xs uppercase tracking-wider text-brand-black">
                  <tr>
                    <th className="px-4 py-3">{i18n("Customer")}</th>
                    <th className="px-4 py-3">{i18n("Phone")}</th>
                    <th className="px-4 py-3">{i18n("Orders")}</th>
                    <th className="px-4 py-3">{i18n("Last order")}</th>
                    <th className="px-4 py-3 text-end">{i18n("Action")}</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => {
                    const isActive =
                      activePhone === customer.phone.trim() && !!report;
                    return (
                      <tr
                        key={customer.phone}
                        className={cn(
                          "border-t border-brand-border transition",
                          isActive ? "bg-brand-light-bg" : "hover:bg-brand-light-bg",
                        )}
                      >
                        <td className="px-4 py-3 font-semibold text-gray-900">
                          {customer.name}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {customer.phone}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {customer.ordersCount}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-gray-700">
                            {customer.lastOrderNumber}
                          </p>
                          <p className="text-xs text-gray-400">
                            {formatDateTime(customer.lastOrderAt, locale)}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-end">
                          <button
                            type="button"
                            onClick={() => {
                              setManualPhone(customer.phone);
                              void runCheck(customer.phone);
                            }}
                            disabled={checking}
                            aria-busy={checking && activePhone === customer.phone.trim()}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-border px-3 py-1.5 text-xs font-semibold text-brand-black transition hover:bg-brand-light-bg disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {checking && activePhone === customer.phone.trim() ? (
                              <ButtonLoader label={i18n("Checking")} />
                            ) : (
                              <>
                                <ShieldCheck className="h-3.5 w-3.5" />
                                {i18n("Check")}</>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="mt-2 text-xs text-gray-500">
          {i18n("{customerCount, plural, one {# customer} other {# customers}} from {orderCount, plural, one {# order} other {# orders}}", { customerCount: customers.length, orderCount: orders.length })}
        </p>
      </div>
    </section>
  );
}
