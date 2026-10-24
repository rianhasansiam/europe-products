"use client";
import { useLocale } from "next-intl";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { useEffect, useMemo, useState } from "react";
import Link from "@/lib/i18n/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  Package,
  RotateCcw,
  ShoppingBag,
  Star,
  XCircle,
} from "lucide-react";

import {
  cancelMyOrder,
  fetchMyOrders,
  type MyOrderSummary,
  type MyOrdersPage,
  type OrderStatus,
} from "@/features/orders/api";
import { PAYMENT_STATUS_META } from "@/features/orders/payment";
import {
  CUSTOMER_CANCELLABLE_STATUSES,
  ORDER_STATUS_META,
} from "@/lib/orders/status";
import {
  LIST_ITEM_TRANSITION,
  LIST_ITEM_VARIANTS,
} from "@/lib/motion/list-removal";
import FormattedCurrencyAmount from "@/components/currency/FormattedCurrencyAmount";
import { TableSkeleton } from "@/components/ui/loading";

import { FALLBACK_PRODUCT_IMAGE, ORDER_STATUS_TONE } from "./constants";

// Curated milestone filters for the order history. Covers the key
// fulfillment stages plus the return/cancel branches without flooding
// the bar with all thirteen statuses.
const FILTER_STATUSES: readonly OrderStatus[] = [
  "PENDING",
  "PAYMENT_CONFIRMED",
  "PACKED",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
];

const STATUS_FILTERS: ReadonlyArray<{ id: OrderStatus | "ALL"; label: string }> = [
  { id: "ALL", label: "All" },
  ...FILTER_STATUSES.map((status) => ({
    id: status,
    label: ORDER_STATUS_META[status].label,
  })),
];

const PAGE_SIZE = 8;
const CANCELLABLE_STATUSES = new Set<OrderStatus>(CUSTOMER_CANCELLABLE_STATUSES);

type LoadState =
  | { status: "loading" }
  | { status: "ready"; page: MyOrdersPage }
  | { status: "error"; message: string };

function formatDate(value: string, locale: string): string {
  try {
    return new Date(value).toLocaleString(locale);
  } catch {
    return value;
  }
}

/**
 * "My Orders" tab.
 *
 * Hits `/api/orders/my-orders` for the listing, paginates with the
 * server's meta block, and delegates the cancellation flow to the
 * existing `/api/orders/[id]/cancel` endpoint. Each row links to the
 * full receipt page already implemented at `/orders/[id]`.
 */
export default function OrdersTab() {
  const i18n = useInterfaceTranslations("InterfaceProfileComponentsOrdersTab");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    void (async () => {
      await Promise.resolve();
      if (ignore) return;
      setState({ status: "loading" });

      try {
        const result = await fetchMyOrders({
          page,
          pageSize: PAGE_SIZE,
          status: statusFilter === "ALL" ? undefined : statusFilter,
        });
        if (ignore) return;
        setState({ status: "ready", page: result });
      } catch (error) {
        if (ignore) return;
        const message =
          error instanceof Error
            ? error.message
            : "Failed to load your orders.";
        setState({ status: "error", message });
      }
    })();

    return () => {
      ignore = true;
    };
  }, [page, statusFilter]);

  const meta = state.status === "ready" ? state.page.meta : null;
  const orders = state.status === "ready" ? state.page.items : [];

  const filteredEmpty = useMemo(() => {
    return state.status === "ready" && orders.length === 0;
  }, [orders.length, state.status]);

  const handleStatusFilterChange = (nextStatus: OrderStatus | "ALL") => {
    setStatusFilter(nextStatus);
    setPage(1);
  };

  const handleCancel = async (orderId: string) => {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(
        "Cancel this order? Stock will be restored and the order moved to Cancelled.",
      );
      if (!confirmed) return;
    }

    setActionError(null);
    setCancellingId(orderId);

    try {
      const updated = await cancelMyOrder(orderId);
      setState((current) => {
        if (current.status !== "ready") return current;
        return {
          status: "ready",
          page: {
            ...current.page,
            items: current.page.items.map((order) =>
              order.id === orderId
                ? { ...order, status: updated.status }
                : order,
            ),
          },
        };
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to cancel order.";
      setActionError(message);
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <header className="rounded-2xl border border-brand-border bg-brand-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-light-bg text-brand-black">
              <Package className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-gray-900 sm:text-lg">
                {i18n("My orders")}</h2>
              <p className="text-xs text-gray-500">
                {i18n("Review every order placed on this account.")}</p>
            </div>
          </div>
          {meta && (
            <p className="text-xs font-medium text-gray-500">
              {meta.total} {meta.total === 1 ? i18n("order") : i18n("orders")} {i18n("total")}</p>
          )}
        </div>

        <div className="-mx-1 mt-4 flex snap-x gap-2 overflow-x-auto px-1 pb-1 scrollbar-none [&::-webkit-scrollbar]:hidden">
          {STATUS_FILTERS.map((filter) => {
            const active = filter.id === statusFilter;
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => handleStatusFilterChange(filter.id)}
                className={
                  active
                    ? "inline-flex shrink-0 snap-start items-center gap-1.5 rounded-xl bg-brand-red px-3 py-1.5 text-xs font-bold text-brand-white shadow-sm"
                    : "inline-flex shrink-0 snap-start items-center gap-1.5 rounded-xl border border-brand-border bg-brand-white px-3 py-1.5 text-xs font-bold text-foreground hover:border-brand-red hover:text-brand-red"
                }
                aria-pressed={active}
              >
                {i18n(filter.label)}
              </button>
            );
          })}
        </div>
      </header>

      {actionError && (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {actionError}
        </div>
      )}

      {state.status === "loading" && (
        <TableSkeleton rows={5} columns={5} ariaLabel={i18n("Loading orders")} />
      )}

      {state.status === "error" && (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm">
          {i18n(state.message)}
        </div>
      )}

      {state.status === "ready" && filteredEmpty && (
        <div className="rounded-2xl border border-brand-border bg-brand-white p-6 text-center shadow-sm sm:rounded-3xl sm:p-10">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-light-bg text-brand-black">
            <Package className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-lg font-extrabold text-gray-900">
            {i18n("No orders here yet")}</h3>
          <p className="mt-1 text-sm text-gray-600">
            {statusFilter === "ALL"
              ? i18n("Your purchases will appear here as soon as you place an order.")
              : i18n("No {value0} orders right now.", { value0: i18n(STATUS_FILTERS.find((f) => f.id === statusFilter)?.label ?? statusFilter) })}
          </p>
          <Link
            href="/products"
            className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-brand-red px-5 py-2.5 text-sm font-bold text-brand-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-red-hover hover:shadow-xl"
          >
            <ShoppingBag className="h-4 w-4" />
            {i18n("Start shopping")}</Link>
        </div>
      )}

      {state.status === "ready" && orders.length > 0 && (
        <ul className="flex flex-col gap-3">
          <AnimatePresence initial={false} mode="popLayout">
            {orders.map((order) => (
              <motion.li
                key={order.id}
                layout
                initial="initial"
                animate="animate"
                exit="exit"
                variants={LIST_ITEM_VARIANTS}
                transition={LIST_ITEM_TRANSITION}
                className="list-none overflow-hidden"
              >
                <OrderRow
                  order={order}
                  cancelling={cancellingId === order.id}
                  onCancel={handleCancel}
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      {meta && meta.totalPages > 1 && (
        <Pagination
          page={meta.page}
          totalPages={meta.totalPages}
          onChange={setPage}
        />
      )}
    </div>
  );
}

function OrderRow({
  order,
  cancelling,
  onCancel,
}: {
  order: MyOrderSummary;
  cancelling: boolean;
  onCancel: (orderId: string) => void;
}) {
  const locale = useLocale();
  const i18n = useInterfaceTranslations("InterfaceProfileComponentsOrdersTab");
  const tone = ORDER_STATUS_TONE[order.status];
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const previewItems = order.items.slice(0, 3);
  const moreItems = order.items.length - previewItems.length;
  const canCancel =
    CANCELLABLE_STATUSES.has(order.status) &&
    !order.requiresPaymentReview &&
    order.paymentMethod !== "AIRWALLEX";
  // After delivery, point the customer at the first ordered product so
  // they can leave a review on its detail page.
  const reviewableProductId =
    order.status === "DELIVERED"
      ? order.items.find((item) => item.product?.id ?? item.productId)
          ?.product?.id ??
        order.items.find((item) => item.productId)?.productId ??
        null
      : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-border bg-brand-white shadow-sm sm:rounded-3xl">
      <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:gap-6">
        <div className="flex min-w-0 flex-1 flex-col items-start gap-3 sm:flex-row sm:gap-4">
          <div className="flex shrink-0 -space-x-3">
            {previewItems.map((item) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={item.id}
                src={item.productImage || FALLBACK_PRODUCT_IMAGE}
                alt={item.productName}
                className="h-12 w-12 rounded-xl border-2 border-white object-cover shadow-sm sm:h-16 sm:w-16"
              />
            ))}
            {moreItems > 0 && (
              <span className="grid h-12 w-12 place-items-center rounded-xl border-2 border-white bg-brand-light-bg text-xs font-bold text-brand-black shadow-sm sm:h-16 sm:w-16">
                +{moreItems}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold text-gray-700">
                #{order.orderNumber}
              </span>
              <span
                className={`inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold leading-tight ${tone.pill}`}
              >
                {i18n(tone.label)}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${PAYMENT_STATUS_META[order.paymentStatus].pill}`}
              >
                {i18n(PAYMENT_STATUS_META[order.paymentStatus].label)}
              </span>
            </div>
            <p className="mt-1.5 truncate text-sm font-bold text-gray-900">
              {order.items[0]?.productName ?? i18n("Order items")}
              {order.items.length > 1 && (
                <span className="text-gray-500">
                  {" "}
                  + {order.items.length - 1}{" "}
                  {order.items.length - 1 === 1 ? i18n("more") : i18n("more")}
                </span>
              )}
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              {itemCount} {itemCount === 1 ? i18n("item") : i18n("items")} ·{" "}
              {formatDate(order.createdAt, locale)}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between lg:flex-col lg:items-end lg:justify-center">
          <div className="text-start sm:text-end">
            <FormattedCurrencyAmount
              amount={order.totalAmount}
              currency={order.currency}
              className="text-lg font-extrabold text-brand-red"
            />
            {order.paymentMethod === "CASH_ON_DELIVERY" &&
              order.currency !== order.paymentCurrency && (
                <p className="mt-0.5 text-[11px] font-medium text-gray-500">
                  {i18n("COD due")}{" "}
                  <FormattedCurrencyAmount
                    amount={Math.max(
                      order.baseTotalAmount - order.baseAdvancePayment,
                      0,
                    )}
                    currency={order.paymentCurrency}
                  />
                </p>
              )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <Link
              href={`/orders/${order.id}`}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-brand-border bg-brand-white px-3 text-xs font-bold text-brand-red transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-red hover:bg-brand-light-bg"
            >
              <Eye className="h-3.5 w-3.5" />
              {i18n("View")}</Link>
            {canCancel ? (
              <button
                type="button"
                onClick={() => onCancel(order.id)}
                disabled={cancelling}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-bold text-rose-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              >
                <XCircle className="h-3.5 w-3.5" />
                {cancelling ? i18n("Cancelling...") : i18n("Cancel")}
              </button>
            ) : reviewableProductId ? (
              <Link
                href={`/products/${reviewableProductId}#reviews`}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-brand-red px-3 text-xs font-bold text-brand-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-red-hover hover:shadow-md"
              >
                <Star className="h-3.5 w-3.5" />
                {i18n("Review")}</Link>
            ) : (
              <Link
                href="/products"
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-brand-red px-3 text-xs font-bold text-brand-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-red-hover hover:shadow-md"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {i18n("Reorder")}</Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (next: number) => void;
}) {
  const i18n = useInterfaceTranslations("InterfaceProfileComponentsOrdersTab");
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-2xl border border-brand-border bg-brand-white p-2.5 text-xs font-semibold text-gray-600 shadow-sm sm:p-3">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="inline-flex items-center gap-1 rounded-xl border border-brand-border bg-brand-white px-3 py-1.5 transition-all duration-200 hover:border-brand-red hover:text-brand-red disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-brand-border disabled:hover:text-gray-600"
      >
        <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" />
        <span className="hidden min-[380px]:inline">{i18n("Previous")}</span>
      </button>
      <span className="text-center">
        {i18n("Page {current, number} of {total, number}", { current: page, total: totalPages })}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className="inline-flex items-center gap-1 rounded-xl border border-brand-border bg-brand-white px-3 py-1.5 transition-all duration-200 hover:border-brand-red hover:text-brand-red disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-brand-border disabled:hover:text-gray-600"
      >
        <span className="hidden min-[380px]:inline">{i18n("Next")}</span>
        <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
      </button>
    </div>
  );
}
