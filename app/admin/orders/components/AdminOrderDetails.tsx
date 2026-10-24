
import { useLocale } from "next-intl";

import { useInterfaceTranslations } from "@/components/i18n/translate";
import Image from "next/image";
import { Package2 } from "lucide-react";
import type { ReactNode } from "react";

import {
  formatCurrency,
  formatDateTime,
  getAdminOrderCustomerType,
  type AdminOrderDetail,
} from "@/features/admin-orders/api";
import {
  paymentMethodLabel,
  PAYMENT_STATUS_META,
} from "@/features/orders/payment";
import { ORDER_STATUS_META } from "@/lib/orders/status";
import { cn } from "@/lib/utils";

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-brand-border bg-white p-4">
      <h3 className="mb-3 text-sm font-bold text-gray-900">{title}</h3>
      {children}
    </section>
  );
}

function AmountRow({
  label,
  amount,
  emphasized = false,
}: {
  label: string;
  amount: number;
  emphasized?: boolean;
}) {
  const locale = useLocale();
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 text-sm",
        emphasized ? "border-t border-brand-border pt-3 font-bold text-gray-900" : "text-gray-600",
      )}
    >
      <dt>{label}</dt>
      <dd className="shrink-0 tabular-nums">{formatCurrency(amount, locale)}</dd>
    </div>
  );
}

export default function AdminOrderDetails({ order }: { order: AdminOrderDetail }) {
  const locale = useLocale();
  const i18n = useInterfaceTranslations("AdminAdminOrdersComponentsAdminOrderDetails");
  const customerType = getAdminOrderCustomerType(order);
  const address = [order.customerArea, order.customerCity, order.customerPostalCode]
    .filter(Boolean)
    .join(", ");
  const balanceDue = Math.max(order.totalAmount - order.advancePayment, 0);
  const canCollectBalance =
    order.paymentStatus !== "PAID" &&
    order.paymentStatus !== "REFUNDED" &&
    !["CANCELLED", "RETURN_REQUESTED", "RETURNED", "REFUNDED"].includes(order.status);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <span className={cn("rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset", ORDER_STATUS_META[order.status].tone.ring)}>
          {i18n(ORDER_STATUS_META[order.status].label)}
        </span>
        <span className={cn("rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset", PAYMENT_STATUS_META[order.paymentStatus].ring)}>
          {i18n(PAYMENT_STATUS_META[order.paymentStatus].label)}
        </span>
      </div>

      {order.requiresPaymentReview && (
        <div role="status" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <p className="font-bold">{i18n("Manual payment review required")}</p>
          <p className="mt-1">{i18n("Review this payment before continuing fulfillment.")}</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <DetailSection title={i18n("Customer")}>
          <p className="break-words text-sm font-semibold text-gray-900">{order.customerName || "Not provided"}</p>
          {customerType && (
            <span className="mt-1 inline-flex rounded-full bg-brand-light-bg px-2 py-0.5 text-xs font-semibold text-brand-text-muted">
              {customerType === "GUEST" ? i18n("Guest") : i18n("Registered")}
            </span>
          )}
          <p className="mt-2 break-words text-sm text-gray-600">{order.customerPhone || "Phone not provided"}</p>
          <p className="mt-1 break-words text-sm text-gray-600">{order.customerEmail || "Email not provided"}</p>
          {customerType === "REGISTERED" && order.user?.email && order.user.email !== order.customerEmail && (
            <p className="mt-2 break-words text-xs text-gray-500">{i18n("Account email: {email}", { email: order.user.email })}</p>
          )}
        </DetailSection>

        <DetailSection title={i18n("Shipping address")}>
          <p className="whitespace-pre-wrap break-words text-sm text-gray-700">{order.customerAddress || "Address not provided"}</p>
          {address && <p className="mt-1 break-words text-sm text-gray-600">{address}</p>}
        </DetailSection>
      </div>

      {order.customerNote && (
        <DetailSection title={i18n("Order note")}>
          <p className="whitespace-pre-wrap break-words text-sm text-gray-700">{order.customerNote}</p>
        </DetailSection>
      )}

      <DetailSection title={i18n("Ordered items")}>
        {order.items.length === 0 ? (
          <p className="text-sm text-gray-500">{i18n("No items recorded for this order.")}</p>
        ) : (
          <ul className="divide-y divide-brand-border">
            {order.items.map((item) => {
              const options = item.attributeSummary || [item.size, item.color].filter(Boolean).join(" · ");
              const variant = [item.variantName, options].filter(Boolean).join(" · ");

              return (
                <li key={item.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-brand-border bg-brand-light-bg">
                    {item.productImage ? (
                      <Image src={item.productImage} alt="" width={64} height={64} className="h-full w-full object-cover" />
                    ) : (
                      <Package2 aria-hidden="true" className="h-6 w-6 text-brand-text-muted" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-semibold text-gray-900">{item.productName}</p>
                    {variant && <p className="mt-0.5 break-words text-xs text-gray-500">{variant}</p>}
                    {item.sku && <p className="mt-0.5 break-words text-xs text-gray-500">{i18n("SKU: {sku}", { sku: item.sku })}</p>}
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                      <p className="text-gray-600">{i18n("Qty {quantity} × {price}", { quantity: item.quantity, price: formatCurrency(item.unitPrice, locale) })}</p>
                      <p className="font-semibold tabular-nums text-gray-900">{formatCurrency(item.totalPrice, locale)}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </DetailSection>

      <DetailSection title={i18n("Payment summary")}>
        <p className="mb-3 text-sm text-gray-600">{paymentMethodLabel(order.paymentMethod)}</p>
        <dl className="space-y-2">
          <AmountRow label={i18n("Subtotal")} amount={order.subtotal} />
          <AmountRow label={i18n("Delivery charge")} amount={order.deliveryCharge} />
          <AmountRow label={order.promoCode ? `Discount (${order.promoCode})` : i18n("Discount")} amount={-order.discountAmount} />
          <AmountRow label={i18n("Tax")} amount={order.taxAmount} />
          <AmountRow label={i18n("Order total")} amount={order.totalAmount} emphasized />
          <AmountRow label={i18n("Advance payment")} amount={order.advancePayment} />
          {(canCollectBalance || order.paymentStatus === "PAID") && (
            <AmountRow label={i18n("Balance due")} amount={order.paymentStatus === "PAID" ? 0 : balanceDue} emphasized />
          )}
        </dl>
      </DetailSection>

      <DetailSection title={i18n("Order information")}>
        <dl className="space-y-2 text-sm">
          <div><dt className="text-xs text-gray-500">{i18n("Order ID")}</dt><dd className="break-all text-gray-700">{order.id}</dd></div>
          <div><dt className="text-xs text-gray-500">{i18n("Placed")}</dt><dd className="text-gray-700">{formatDateTime(order.createdAt, locale)}</dd></div>
          <div><dt className="text-xs text-gray-500">{i18n("Last updated")}</dt><dd className="text-gray-700">{formatDateTime(order.updatedAt, locale)}</dd></div>
        </dl>
      </DetailSection>

      <DetailSection title={i18n("Status history")}>
        {order.statusHistory.length === 0 ? (
          <p className="text-sm text-gray-500">{i18n("No status history recorded for this order.")}</p>
        ) : (
          <ol className="space-y-3 border-s-2 border-brand-border ps-4">
            {order.statusHistory.map((entry) => (
              <li key={entry.id}>
                <p className="text-sm font-semibold text-gray-900">{i18n(ORDER_STATUS_META[entry.status].label)}</p>
                <p className="mt-0.5 text-xs text-gray-500">{formatDateTime(entry.createdAt, locale)}</p>
                {entry.note && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-600">{entry.note}</p>}
              </li>
            ))}
          </ol>
        )}
      </DetailSection>
    </div>
  );
}
