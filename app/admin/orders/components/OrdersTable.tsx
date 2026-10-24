"use client";
import { useLocale } from "next-intl";

import { useInterfaceTranslations } from "@/components/i18n/translate";


import { Fragment, useState } from "react";
import { ChevronDown, Eye, Package2 } from "lucide-react";

import {
  formatCurrency,
  formatDateTime,
  getAdminOrderCustomerType,
  STATUS_TRANSITIONS,
  type AdminOrderRow,
  type OrderStatus,
  type PaymentStatus,
} from "@/features/admin-orders/api";
import {
  paymentMethodLabel,
  PAYMENT_STATUS_META,
} from "@/features/orders/payment";
import { LoadingSpinner, TableSkeleton } from "@/components/ui/loading";
import { ORDER_STATUS_META } from "@/lib/orders/status";
import { cn } from "@/lib/utils";

const PAYMENT_BADGE: Record<PaymentStatus, string> = {
  PAID: PAYMENT_STATUS_META.PAID.ring,
  UNPAID: PAYMENT_STATUS_META.UNPAID.ring,
  PENDING: PAYMENT_STATUS_META.PENDING.ring,
  FAILED: PAYMENT_STATUS_META.FAILED.ring,
  REFUNDED: PAYMENT_STATUS_META.REFUNDED.ring,
};

function DetailBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-brand-border bg-white p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-text-muted">
        {label}
      </p>
      <p className="mt-1 text-sm text-gray-700">{children}</p>
    </div>
  );
}

export default function OrdersTable({
  orders,
  isLoading,
  totalCount,
  busyOrderId,
  expandedId,
  onToggleExpand,
  onViewDetails,
  onChangeStatus,
  onTogglePayment,
  onApprovePaymentReview,
  onRecordPaymentRefund,
}: {
  orders: AdminOrderRow[];
  isLoading: boolean;
  totalCount: number;
  busyOrderId: string | null;
  expandedId: string | null;
  onToggleExpand: (id: string | null) => void;
  onViewDetails: (order: AdminOrderRow) => void;
  onChangeStatus: (order: AdminOrderRow, next: OrderStatus) => void;
  onTogglePayment: (order: AdminOrderRow) => void;
  onApprovePaymentReview: (order: AdminOrderRow) => void;
  onRecordPaymentRefund: (
    order: AdminOrderRow,
    refundReference: string,
  ) => void;
}) {
  const locale = useLocale();
  const i18n = useInterfaceTranslations("AdminAdminOrdersComponentsOrdersTable");
  const [refundReferences, setRefundReferences] = useState<
    Record<string, string>
  >({});

  if (isLoading && totalCount === 0) {
    return <TableSkeleton rows={6} columns={8} ariaLabel="Loading orders" />;
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border border-brand-border bg-white p-10 text-center text-sm text-gray-600 shadow-sm">
        <Package2 className="mx-auto mb-2 h-8 w-8 text-brand-text-muted" />
        {i18n("No orders match the current filters.")}</div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-border bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-brand-light-bg text-start text-xs uppercase tracking-wider text-brand-text-muted">
            <tr>
              <th className="px-4 py-3">{i18n("Order")}</th>
              <th className="px-4 py-3">{i18n("Customer")}</th>
              <th className="px-4 py-3">{i18n("Items")}</th>
              <th className="px-4 py-3">{i18n("Total")}</th>
              <th className="px-4 py-3">{i18n("Status")}</th>
              <th className="px-4 py-3">{i18n("Payment")}</th>
              <th className="px-4 py-3">{i18n("Placed")}</th>
              <th className="px-4 py-3 text-end">{i18n("Actions")}</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const isBusy = busyOrderId === order.id;
              const isExpanded = expandedId === order.id;
              const customerType = getAdminOrderCustomerType(order);
              const isGatewayManaged =
                order.paymentMethod === "SSLCOMMERZ" ||
                order.paymentMethod === "AIRWALLEX";
              const allowedNext = STATUS_TRANSITIONS[order.status].filter(
                (status) =>
                  !(
                    isGatewayManaged &&
                    (order.requiresPaymentReview ||
                      (status === "PAYMENT_CONFIRMED" &&
                        order.paymentStatus !== "PAID") ||
                      (status === "CANCELLED" &&
                        (order.paymentStatus === "PAID" ||
                          order.paymentMethod === "AIRWALLEX")))
                  ),
              );

              return (
                <Fragment key={order.id}>
                  <tr className="border-t border-brand-border align-top">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => onToggleExpand(isExpanded ? null : order.id)}
                        aria-expanded={isExpanded}
                        className="inline-flex items-center gap-1 text-start font-semibold text-brand-red transition hover:text-brand-red-hover"
                      >
                        <ChevronDown
                          className={cn(
                            "h-3.5 w-3.5 transition-transform",
                            isExpanded ? "rotate-180" : "",
                          )}
                        />
                        {order.orderNumber}
                      </button>
                      <p className="mt-1 truncate text-xs text-gray-500">
                        {order.id}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900">
                        {order.customerName}
                      </p>
                      {customerType && (
                        <span className="my-1 inline-flex rounded-full bg-brand-light-bg px-2 py-0.5 text-[11px] font-semibold text-brand-text-muted ring-1 ring-inset ring-brand-border">
                          {customerType === "GUEST" ? i18n("Guest") : i18n("Registered")}
                        </span>
                      )}
                      <p className="text-xs text-gray-500">
                        {order.customerPhone}
                      </p>
                      {(order.customerEmail || order.user?.email) && (
                        <p className="text-xs text-gray-400">
                          {order.customerEmail || order.user?.email}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {order.itemsCount}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900">
                        {formatCurrency(order.totalAmount, locale)}
                      </p>
                      {order.discountAmount > 0 && (
                        <p className="text-xs text-brand-red">
                          -{formatCurrency(order.discountAmount, locale)} {i18n("discount")}</p>
                      )}
                      {order.advancePayment > 0 && (
                        <>
                          <p className="text-xs text-emerald-700">
                            {formatCurrency(order.advancePayment, locale)} {i18n("advance paid")}</p>
                          <p className="text-xs text-gray-500">
                            {formatCurrency(
                              Math.max(order.totalAmount - order.advancePayment, 0), locale
                            )} {i18n("due")}</p>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset",
                          ORDER_STATUS_META[order.status].tone.ring,
                        )}
                      >
                        {i18n(ORDER_STATUS_META[order.status].label)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset",
                          PAYMENT_BADGE[order.paymentStatus],
                        )}
                      >
                        {i18n(PAYMENT_STATUS_META[order.paymentStatus].label)}
                      </span>
                      <p className="mt-1 text-xs text-gray-500">
                        {paymentMethodLabel(order.paymentMethod)}
                      </p>
                      {order.requiresPaymentReview && (
                        <div className="mt-1 text-xs text-rose-700">
                          <p className="font-bold">{i18n("Manual review required")}</p>
                          {order.paymentReviewReasons.map((reason) => (
                            <p key={reason} className="max-w-48">
                              {reason.replaceAll("_", " ").toLowerCase()}
                            </p>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {formatDateTime(order.createdAt, locale)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-end gap-2">
                        <button
                          type="button"
                          onClick={() => onViewDetails(order)}
                          aria-label={`View details for ${order.orderNumber}`}
                          aria-haspopup="dialog"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-brand-border px-2.5 py-1.5 text-xs font-semibold text-brand-red transition hover:border-brand-red hover:bg-brand-light-bg"
                        >
                          <Eye aria-hidden="true" className="h-3.5 w-3.5" />
                          {i18n("View details")}</button>
                        {allowedNext.length > 0 ? (
                          <select
                            value=""
                            disabled={isBusy}
                            onChange={(event) => {
                              const next = event.target.value as OrderStatus;
                              if (!next) return;
                              onChangeStatus(order, next);
                            }}
                            className="h-8 rounded-lg border border-brand-border px-2 text-xs font-semibold text-foreground transition hover:bg-brand-light-bg disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <option value="">{i18n("Change status")}</option>
                            {allowedNext.map((status) => (
                              <option key={status} value={status}>
                                {i18n("Move to")}{" "}{i18n(ORDER_STATUS_META[status].label)}
                              </option>
                            ))}
                          </select>
                        ) : order.requiresPaymentReview ? (
                          <span className="text-[11px] font-semibold text-rose-700">
                            {i18n("Review hold")}</span>
                        ) : (
                          <span className="text-[11px] uppercase tracking-wide text-gray-400">
                            {i18n("Final")}</span>
                        )}

                        {isGatewayManaged ? (
                          <div className="flex max-w-52 flex-col items-end gap-1.5">
                            {order.requiresPaymentReview &&
                            order.paymentReviewApprovalAllowed ? (
                              <button
                                type="button"
                                onClick={() => onApprovePaymentReview(order)}
                                disabled={isBusy}
                                aria-busy={isBusy}
                                className="inline-flex items-center gap-1 rounded-lg border border-amber-300 px-2.5 py-1 text-xs font-semibold text-amber-800 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {isBusy && (
                                  <LoadingSpinner decorative size="xs" />
                                )}
                                {i18n("Approve payment review")}</button>
                            ) : order.requiresPaymentReview ? (
                              <span className="text-end text-[11px] font-semibold text-rose-700">
                                {i18n("Gateway/refund investigation required")}</span>
                            ) : (
                              <span className="text-[11px] font-semibold text-sky-700">
                                {i18n("Gateway managed")}</span>
                            )}

                            {order.requiresPaymentReview &&
                              order.paymentReviewRefundCancellationAllowed && (
                                <>
                                  <input
                                    type="text"
                                    value={refundReferences[order.id] ?? ""}
                                    onChange={(event) =>
                                      setRefundReferences((current) => ({
                                        ...current,
                                        [order.id]: event.target.value,
                                      }))
                                    }
                                    maxLength={200}
                                    autoComplete="off"
                                    aria-label={`Refund reference for ${order.orderNumber}`}
                                    placeholder={i18n("Provider refund reference")}
                                    className="h-8 w-full rounded-lg border border-brand-border px-2 text-xs outline-none focus:border-brand-red"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onRecordPaymentRefund(
                                        order,
                                        (refundReferences[order.id] ?? "").trim(),
                                      )
                                    }
                                    disabled={
                                      isBusy ||
                                      (refundReferences[order.id] ?? "").trim()
                                        .length < 4
                                    }
                                    aria-busy={isBusy}
                                    className="inline-flex items-center gap-1 rounded-lg border border-rose-300 px-2.5 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {isBusy && (
                                      <LoadingSpinner decorative size="xs" />
                                    )}
                                    {i18n("Record refund & cancel")}</button>
                                </>
                              )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onTogglePayment(order)}
                            disabled={isBusy || order.status === "CANCELLED"}
                            aria-busy={isBusy}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isBusy && <LoadingSpinner decorative size="xs" />}
                            {i18n("Mark")}{" "}
                            {order.paymentStatus === "PAID" ? i18n("unpaid") : i18n("paid")}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr className="border-t border-brand-border bg-brand-light-bg">
                      <td colSpan={8} className="px-4 py-3">
                        <div className="grid gap-3 sm:grid-cols-3">
                          <DetailBlock label={i18n("Customer")}>
                            {order.customerName}
                            {customerType && <> · {customerType === "GUEST" ? i18n("Guest") : i18n("Registered")}</>}
                            <br />
                            {order.customerPhone}
                            {order.customerEmail && <><br />{order.customerEmail}</>}
                          </DetailBlock>
                          <DetailBlock label={i18n("Shipping address")}>
                            {order.customerAddress || "-"}
                            {[order.customerArea, order.customerCity, order.customerPostalCode].filter(Boolean).length > 0 && (
                              <><br />{[order.customerArea, order.customerCity, order.customerPostalCode].filter(Boolean).join(", ")}</>
                            )}
                          </DetailBlock>
                          {order.customerNote && (
                            <DetailBlock label={i18n("Order note")}>
                              <span className="whitespace-pre-wrap">{order.customerNote}</span>
                            </DetailBlock>
                          )}
                          <DetailBlock label={i18n("Subtotal / delivery")}>
                            {formatCurrency(order.subtotal, locale)} +{" "}
                            {formatCurrency(order.deliveryCharge, locale)} {i18n("delivery")}</DetailBlock>
                          <DetailBlock label={i18n("Last update")}>
                            {formatDateTime(order.updatedAt, locale)}
                          </DetailBlock>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
