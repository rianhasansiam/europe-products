"use client";
import { useLocale } from "next-intl";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "@/lib/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/lib/i18n/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Mail,
  MapPin,
  Package,
  Phone,
  ShoppingBag,
  Truck,
  User,
} from "lucide-react";
import { useSession } from "@/lib/auth/use-app-session";

import { fetchOrderDetail, type OrderDetail } from "@/features/orders/api";
import {
  getAirwallexPaymentDisplay,
  isAwaitingAirwallexConfirmation,
  paymentMethodLabel,
  PAYMENT_STATUS_META,
} from "@/features/orders/payment";
import { downloadOrderPdf } from "@/features/orders/pdf";
import { clearOrderSnapshot } from "@/features/orders/storage";
import { ORDER_STATUS_META } from "@/lib/orders/status";
import {
  BASE_CURRENCY,
  isHistoricalCurrencyCode,
  type CurrencyCode,
} from "@/lib/currency/config";
import FormattedCurrencyAmount from "@/components/currency/FormattedCurrencyAmount";
import ColorBadge from "@/components/ui/ColorBadge";
import { ButtonLoader, OrderDetailsPageSkeleton } from "@/components/ui/loading";
import { AirwallexPayButton } from "@/lib/airwallex/components/AirwallexPayButton";
import { AirwallexPaymentStatus } from "@/lib/airwallex/components/AirwallexPaymentStatus";
import { trackPendingOrderPurchase } from "@/lib/analytics/order-purchase-browser";
import OrderTracker from "./OrderTracker";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1542838132-92c53300491e?w=400";
type OrderSummaryClientProps = {
  orderId: string;
};

type LoadState =
  | { status: "loading" }
  | { status: "ready"; order: OrderDetail }
  | { status: "error"; message: string };

function formatDateTime(value: string, locale: string): string {
  try {
    return new Date(value).toLocaleString(locale);
  } catch {
    return value;
  }
}

const STATUS_TONE: Record<
  OrderDetail["status"],
  { label: string; pill: string }
> = Object.fromEntries(
  Object.entries(ORDER_STATUS_META).map(([status, meta]) => [
    status,
    { label: meta.label, pill: meta.tone.pill },
  ]),
) as Record<OrderDetail["status"], { label: string; pill: string }>;

export default function OrderSummaryClient({ orderId }: OrderSummaryClientProps) {
  const locale = useLocale();
  const i18n = useInterfaceTranslations("InterfaceOrdersIdComponentsOrderSummaryClient");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status: authStatus } = useSession();

  const justPlaced = searchParams.get("just-placed") === "1";

  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Load only through the owner-scoped API. Browser storage is untrusted and
  // must never paint another customer's or a forged receipt.
  useEffect(() => {
    if (authStatus === "loading") return;

    let ignore = false;
    clearOrderSnapshot();

    void (async () => {
      try {
        const order = await fetchOrderDetail(orderId);
        if (ignore) return;
        setState({ status: "ready", order });
      } catch (error) {
        if (ignore) return;
        const message =
          error instanceof Error
            ? error.message
            : "We couldn't find this order on your account.";
        setState({ status: "error", message });
      }
    })();

    return () => {
      ignore = true;
    };
  }, [authStatus, orderId]);

  const order = state.status === "ready" ? state.order : null;

  useEffect(() => {
    // The owner/cookie-scoped API derives this snapshot from verified payment
    // records. A local checkout intent also protects against historical or
    // unrelated admin receipt views; URL flags and COD confirmation never qualify.
    if (order) trackPendingOrderPurchase(order, session?.user?.id);
  }, [order, session?.user?.id]);

  const totalSavings = useMemo(() => {
    if (!order) return 0;
    return Math.max(0, order.discountAmount);
  }, [order]);

  const refreshSettledAirwallexOrder = useCallback(() => {
    void (async () => {
      try {
        const nextOrder = await fetchOrderDetail(orderId);
        setState({ status: "ready", order: nextOrder });
      } catch {
        // Keep the already-rendered owner-scoped order on a transient failure.
        // The Airwallex status card retains a manual refresh action.
      }
    })();
  }, [orderId]);

  const handleDownload = async () => {
    if (!order || downloading) return;
    setDownloadError(null);
    setDownloading(true);
    try {
      // Yield a frame so the loading state can paint before jsPDF
      // takes the main thread.
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      await downloadOrderPdf(order);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to generate PDF.";
      setDownloadError(message);
    } finally {
      setDownloading(false);
    }
  };

  if (
    authStatus === "loading" ||
    state.status === "loading"
  ) {
    return <OrderDetailsPageSkeleton />;
  }

  if (state.status === "error" || !order) {
    const message =
      state.status === "error"
          ? state.message
          : "Sign in or use the browser you checked out with to view this order.";
    return (
      <main className="min-h-screen bg-brand-light-bg">
        <div className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6">
          <div className="rounded-3xl border border-rose-200 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-rose-100 text-rose-700">
              <AlertCircle className="h-7 w-7" />
            </div>
            <h1 className="mt-4 text-2xl font-extrabold text-gray-900">
              {i18n("Order not available")}</h1>
            <p className="mt-2 text-sm text-gray-600">
              {i18n(message)}
            </p>
            <div className="mt-6 flex flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-3">
              <Link
                href="/products"
                className="inline-flex items-center gap-2 rounded-2xl bg-brand-red px-5 py-2.5 text-sm font-bold text-brand-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-red-hover hover:shadow-xl"
              >
                <ShoppingBag className="h-4 w-4" />
                {i18n("Browse products")}</Link>
              {authStatus !== "authenticated" && (
                <Link
                  href={`/login?callbackUrl=/orders/${orderId}`}
                  className="inline-flex items-center gap-2 rounded-2xl border border-brand-border bg-brand-white px-5 py-2.5 text-sm font-bold text-brand-black transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-red hover:bg-brand-light-bg"
                >
                  {i18n("Sign in")}</Link>
              )}
            </div>
          </div>
        </div>
      </main>
    );
  }

  const statusBadge = STATUS_TONE[order.status] ?? STATUS_TONE.PENDING;
  const paymentBadge =
    PAYMENT_STATUS_META[order.paymentStatus] ?? PAYMENT_STATUS_META.UNPAID;
  const paymentUnderReview = order.requiresPaymentReview;
  const isAirwallexOrder = order.paymentMethod === "AIRWALLEX";
  const canPayWithAirwallex =
    isAirwallexOrder &&
    order.baseCurrency === BASE_CURRENCY &&
    order.currency === BASE_CURRENCY &&
    !paymentUnderReview &&
    order.status === "PENDING" &&
    (isAwaitingAirwallexConfirmation(
      order.paymentMethod,
      order.paymentStatus,
    ) || order.paymentStatus === "FAILED");
  const currency = isHistoricalCurrencyCode(order.currency)
    ? order.currency
    : BASE_CURRENCY;
  const paymentCurrency = isHistoricalCurrencyCode(order.paymentCurrency)
    ? order.paymentCurrency
    : BASE_CURRENCY;
  const airwallexPaymentCharge = getAirwallexPaymentDisplay({
    paymentMethod: order.paymentMethod,
    paymentAmount: order.paymentAmount,
    paymentCurrency: order.paymentCurrency,
    displayAmount: order.totalAmount,
    displayCurrency: currency,
  });

  const addressLines = [
    order.customerAddress,
    [order.customerCity, order.customerPostalCode]
      .filter((part): part is string => Boolean(part))
      .join(" "),
  ].filter(Boolean);

  return (
    <main className="min-h-screen bg-brand-light-bg">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Hero */}
        <section className="overflow-hidden rounded-3xl border border-brand-border bg-brand-white shadow-sm">
          <div className="relative bg-brand-black px-6 py-8 text-brand-white sm:px-10">
            <div
              className="pointer-events-none absolute inset-0 opacity-10"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
                backgroundSize: "22px 22px",
              }}
            />
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                {justPlaced ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wider backdrop-blur-md">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {i18n("Order placed")}</span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wider backdrop-blur-md">
                    {i18n("Order summary")}</span>
                )}
                <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
                  #{order.orderNumber}
                </h1>
                <p className="mt-2 text-sm text-white/85">
                  {i18n("Placed on")}{formatDateTime(order.createdAt, locale)}
                </p>
              </div>
              <div className="flex flex-col items-start gap-2 sm:items-end">
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={downloading}
                  className="inline-flex items-center gap-2 rounded-2xl bg-white/15 px-4 py-2 text-sm font-bold text-white backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                  aria-busy={downloading}
                >
                  {downloading ? (
                    <ButtonLoader label={i18n("Generating PDF...")} />
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      {i18n("Download PDF")}</>
                  )}
                </button>
                {downloadError && (
                  <p className="rounded-lg bg-rose-500/30 px-2 py-1 text-[11px] font-medium text-white">
                    {downloadError}
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="grid gap-3 border-t border-brand-border p-5 sm:grid-cols-4 sm:p-6">
            <Stat label={i18n("Order ID")} value={order.id} mono />
            <Stat label={i18n("Order date")} value={formatDateTime(order.createdAt, locale)} />
            <Stat
              label={i18n("Order status")}
              custom={
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${statusBadge.pill}`}
                >
                  <Package className="h-3.5 w-3.5" />
                  {i18n(statusBadge.label)}
                </span>
              }
            />
            <Stat
              label={i18n("Payment")}
              custom={
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-gray-900">
                    {paymentMethodLabel(order.paymentMethod)}
                  </span>
                  <span
                    className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${paymentBadge.pill}`}
                  >
                    {i18n(paymentBadge.label)}
                  </span>
                </div>
              }
            />
          </div>
        </section>

        {paymentUnderReview && !isAirwallexOrder && (
          <section aria-live="polite" className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Historical payment is on hold for review. Contact support for assistance.
          </section>
        )}

        {isAirwallexOrder ? (
          <div className="mt-5 space-y-4">
            <AirwallexPaymentStatus
              orderId={order.id}
              autoPoll={false}
              showOrderLink={false}
              embedded
              onSettled={refreshSettledAirwallexOrder}
            />
            {canPayWithAirwallex ? (
              <section className="rounded-3xl border border-brand-border bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-lg font-bold text-gray-900">
                  {order.paymentStatus === "FAILED"
                    ? i18n("Try payment again")
                    : i18n("Complete your payment")}
                </h2>
                <p className="mt-1 text-sm leading-6 text-gray-600">
                  {i18n("Your order and inventory are reserved. Continue to Airwallex's hosted checkout; SexToy does not collect your card details.")}</p>
                <AirwallexPayButton
                  orderId={order.id}
                  label={
                    order.paymentStatus === "FAILED"
                      ? i18n("Retry secure payment")
                      : i18n("Continue to secure payment")
                  }
                  className="mt-4 h-12 w-full rounded-2xl bg-brand-red px-5 text-base font-bold text-white sm:w-auto"
                />
              </section>
            ) : null}
          </div>
        ) : null}

        {/* Tracking timeline */}
        <OrderTracker
          status={order.status}
          history={order.statusHistory ?? []}
          className="mt-6"
        />

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex flex-col gap-5">
            {/* Customer + shipping */}
            <section className="rounded-3xl border border-brand-border bg-brand-white p-5 shadow-sm sm:p-6">
              <header className="mb-4 flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-light-bg text-brand-black">
                  <User className="h-4 w-4" />
                </span>
                <h2 className="text-lg font-bold text-gray-900">
                  {i18n("Customer details")}</h2>
              </header>
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <Field
                  icon={<User className="h-4 w-4" />}
                  label={i18n("Name")}
                  value={order.customerName}
                />
                <Field
                  icon={<Phone className="h-4 w-4" />}
                  label={i18n("Phone")}
                  value={order.customerPhone}
                />
                <Field
                  icon={<Mail className="h-4 w-4" />}
                  label={i18n("Email")}
                  value={order.customerEmail ?? "—"}
                />
                <Field
                  icon={<Truck className="h-4 w-4" />}
                  label={i18n("Payment method")}
                  value={paymentMethodLabel(order.paymentMethod)}
                />
                <div className="sm:col-span-2">
                  <Field
                    icon={<MapPin className="h-4 w-4" />}
                    label={i18n("Shipping address")}
                    value={addressLines.join(", ")}
                  />
                </div>
                {order.customerNote && (
                  <div className="sm:col-span-2">
                    <Field
                      icon={<Mail className="h-4 w-4" />}
                      label={i18n("Note from customer")}
                      value={order.customerNote}
                    />
                  </div>
                )}
              </dl>
            </section>

            {/* Items */}
            <section className="rounded-3xl border border-brand-border bg-brand-white p-5 shadow-sm sm:p-6">
              <header className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-light-bg text-brand-black">
                    <Package className="h-4 w-4" />
                  </span>
                  <h2 className="text-lg font-bold text-gray-900">{i18n("Items")}</h2>
                </div>
                <span className="text-xs text-gray-500">
                  {order.items.length}{" "}
                  {order.items.length === 1 ? i18n("product") : i18n("products")}
                </span>
              </header>
              <ul className="divide-y divide-brand-border">
                {order.items.map((item) => {
                  return (
                    <li
                      key={item.id}
                      className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-brand-border bg-brand-light-bg">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.productImage || FALLBACK_IMAGE}
                          alt={item.productName}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-900">
                          {item.productName}
                        </p>
                        <ColorBadge
                          color={item.color}
                          size={item.size}
                          className="mt-0.5"
                        />
                        {(item.variantName || item.attributeSummary) && (
                          <p className="mt-0.5 line-clamp-2 text-[11px] text-gray-500">
                            {[item.variantName, item.attributeSummary]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        )}
                        <p className="mt-0.5 text-xs text-gray-500">
                          {i18n("Qty")}{item.quantity} ·{" "}
                          <FormattedCurrencyAmount
                            amount={item.unitPrice}
                            currency={currency}
                          />{" "}
                          {i18n("each")}</p>
                      </div>
                      <FormattedCurrencyAmount
                        amount={item.totalPrice}
                        currency={currency}
                        className="text-sm font-bold text-gray-900"
                      />
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>

          {/* Totals */}
          <aside className="lg:sticky lg:top-[88px] lg:self-start">
            <section className="rounded-3xl border border-brand-border bg-brand-white p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-bold text-gray-900">{i18n("Total")}</h2>
              <div className="mt-4 space-y-2.5 text-sm">
                <SummaryRow
                  label={i18n("Subtotal")}
                  value={order.subtotal}
                  currency={currency}
                />
                {order.discountAmount > 0 && (
                  <SummaryRow
                    label={
                      order.promoCode
                        ? i18n("Discount ({value0})", { value0: order.promoCode })
                        : i18n("Discount")
                    }
                    value={-order.discountAmount}
                    tone="success"
                    currency={currency}
                  />
                )}
                <SummaryRow
                  label={i18n("Delivery charge")}
                  value={order.deliveryCharge}
                  freeLabel={order.deliveryCharge === 0 ? "FREE" : undefined}
                  currency={currency}
                />
                {order.taxAmount > 0 && (
                  <SummaryRow
                    label={i18n("Tax")}
                    value={order.taxAmount}
                    currency={currency}
                  />
                )}
                {order.advancePayment > 0 && (
                  <>
                    <SummaryRow
                      label={i18n("Advance payment")}
                      value={-order.advancePayment}
                      tone="success"
                      currency={currency}
                    />
                    <SummaryRow
                      label={i18n("Balance due")}
                      value={Math.max(
                        order.totalAmount - order.advancePayment,
                        0,
                      )}
                      currency={currency}
                    />
                  </>
                )}
              </div>
              <div className="mt-4 rounded-2xl border border-brand-border bg-brand-light-bg p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-gray-700">
                    {i18n("Grand total")}</span>
                  <FormattedCurrencyAmount
                    amount={order.totalAmount}
                    currency={currency}
                    className="text-2xl font-extrabold text-brand-red sm:text-3xl"
                  />
                </div>
                {airwallexPaymentCharge && (
                  <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-brand-border pt-3">
                    <span className="text-xs font-semibold text-gray-600">
                      {order.paymentStatus === "PAID" ||
                      order.paymentStatus === "REFUNDED"
                        ? i18n("Airwallex charge")
                        : i18n("Expected Airwallex payment")}
                    </span>
                    <FormattedCurrencyAmount
                      amount={airwallexPaymentCharge.amount}
                      currency={airwallexPaymentCharge.currency}
                      className="shrink-0 text-base font-bold text-gray-900"
                    />
                  </div>
                )}
                {totalSavings > 0 && (
                  <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                    {i18n("You saved")}{" "}
                    <FormattedCurrencyAmount
                      amount={totalSavings}
                      currency={currency}
                    />
                  </p>
                )}
              </div>
              {currency !== order.baseCurrency && (
                <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-[11px] font-medium leading-5 text-sky-900">
                  <p>
                    {i18n("Saved order snapshot: 1")}{order.baseCurrency} ={" "}
                    {order.exchangeRate} {currency}
                    {order.exchangeRateTimestamp
                      ? i18n(" on {value0}", { value0: formatDateTime(order.exchangeRateTimestamp, locale) })
                      : ""}
                    .
                  </p>
                  {order.paymentMethod === "CASH_ON_DELIVERY" && (
                    <p className="mt-1 font-semibold text-amber-800">
                      {i18n("Cash on delivery amount due in BDT:")}{" "}
                      <FormattedCurrencyAmount
                        amount={Math.max(
                          order.baseTotalAmount - order.baseAdvancePayment,
                          0,
                        )}
                        currency={paymentCurrency}
                      />
                      .
                    </p>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-red text-base font-bold text-brand-white shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-brand-red-hover hover:shadow-xl disabled:cursor-not-allowed disabled:bg-gray-300 disabled:hover:translate-y-0"
                aria-busy={downloading}
              >
                {downloading ? (
                  <ButtonLoader label={i18n("Generating PDF...")} />
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    {i18n("Download PDF receipt")}</>
                )}
              </button>
              {downloadError && (
                <p className="mt-2 flex items-start gap-1.5 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs font-medium text-red-700">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {downloadError}
                </p>
              )}
              <button
                type="button"
                onClick={() => router.push("/products")}
                className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-brand-border bg-brand-white text-sm font-bold text-brand-black transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-red hover:bg-brand-light-bg"
              >
                <ShoppingBag className="h-4 w-4" />
                {i18n("Continue shopping")}</button>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Field({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  const i18n = useInterfaceTranslations("InterfaceOrdersIdComponentsOrderSummaryClient");
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-light-bg text-brand-black">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          {i18n(label)}
        </p>
        <p className="mt-0.5 wrap-break-word text-sm font-medium text-gray-900">
          {value}
        </p>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  custom,
  mono,
}: {
  label: string;
  value?: string;
  custom?: React.ReactNode;
  mono?: boolean;
}) {
  const i18n = useInterfaceTranslations("InterfaceOrdersIdComponentsOrderSummaryClient");
  return (
    <div className="rounded-2xl border border-brand-border bg-brand-white p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        {i18n(label)}
      </p>
      <div className="mt-1">
        {custom ? (
          custom
        ) : (
          <p
            className={`break-all text-sm font-bold text-gray-900 ${mono ? "font-mono" : ""}`}
          >
            {value}
          </p>
        )}
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  tone = "default",
  freeLabel,
  currency,
}: {
  label: string;
  value: number;
  tone?: "default" | "success";
  freeLabel?: string;
  currency: CurrencyCode;
}) {
  const i18n = useInterfaceTranslations("InterfaceOrdersIdComponentsOrderSummaryClient");
  return (
    <div className="flex items-start justify-between gap-2 sm:items-center">
      <span className="min-w-0 flex-1 text-gray-600 [overflow-wrap:anywhere]">
        {i18n(label)}
      </span>
      {freeLabel ? (
        <span className="shrink-0 font-bold uppercase tracking-wider text-emerald-600">
          {freeLabel}
        </span>
      ) : (
        <FormattedCurrencyAmount
          amount={value}
          currency={currency}
          className={`shrink-0 text-end font-semibold ${
            tone === "success" ? "text-emerald-600" : "text-gray-900"
          }`}
        />
      )}
    </div>
  );
}
