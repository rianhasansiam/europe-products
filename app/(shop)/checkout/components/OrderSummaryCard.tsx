"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import {
  AlertCircle,
  Check,
  ChevronRight,
  Lock,
  ShieldCheck,
  Sparkles,
  Tag,
  X,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import FormattedCurrencyAmount from "@/components/currency/FormattedCurrencyAmount";
import { ButtonLoader, Skeleton } from "@/components/ui/loading";
import type {
  CheckoutPaymentMethod,
  CheckoutPreview,
  CheckoutSummary,
} from "@/features/checkout/api";
import type { CurrencyCode } from "@/lib/currency/config";

type CartItemBrief = {
  id: string;
  productId: string;
  quantity: number;
};

type OrderSummaryCardProps = {
  deliveryAreaSelected: boolean;
  summary: CheckoutSummary | null;
  items: CartItemBrief[];
  isLoading: boolean;
  promoCode: string;
  appliedPromo: string | null;
  onPromoCodeChange: (value: string) => void;
  onApplyPromo: () => void;
  onRemovePromo: () => void;
  promoFeedback: { tone: "success" | "error"; message: string } | null;
  onPlaceOrder: () => void;
  isPlacing: boolean;
  submitError: string | null;
  paymentMethod: CheckoutPaymentMethod;
  airwallexPaymentQuote: CheckoutPreview["airwallexPaymentQuote"];
};

export default function OrderSummaryCard({
  deliveryAreaSelected,
  summary,
  isLoading,
  promoCode,
  appliedPromo,
  onPromoCodeChange,
  onApplyPromo,
  onRemovePromo,
  promoFeedback,
  onPlaceOrder,
  isPlacing,
  submitError,
  paymentMethod,
  airwallexPaymentQuote,
}: OrderSummaryCardProps) {
  const i18n = useInterfaceTranslations("InterfaceCheckoutComponentsOrderSummaryCard");
  const totalSaved = summary?.totalSaved ?? 0;

  const buttonLabel = isPlacing ? "Starting secure checkout..." : "Pay securely with Airwallex";
  const isApplyingPromo = isLoading && Boolean(promoCode.trim()) && !appliedPromo;

  return (
    <aside
      className="flex flex-col gap-4 rounded-3xl border border-brand-border bg-brand-white p-5 shadow-sm sm:p-6"
      aria-busy={isLoading || isPlacing}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">{i18n("Order summary")}</h2>
        <span className="rounded-full bg-brand-light-bg px-2.5 py-0.5 text-xs font-semibold text-brand-black">
          {i18n("Server-priced")}</span>
      </div>

      {/* Promo code */}
      {appliedPromo ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500 text-white">
              <Check className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex min-w-0 items-center gap-1.5 text-sm font-bold text-emerald-800">
                <span
                  title={appliedPromo}
                  className="min-w-0 flex-1 truncate rounded-md bg-white px-1.5 py-0.5 font-mono text-xs text-emerald-700"
                >
                  {appliedPromo}
                </span>
                <span className="shrink-0">{i18n("applied")}</span>
              </p>
              {summary && (
                <p className="truncate text-xs text-emerald-700">
                  <FormattedCurrencyAmount
                    amount={-summary.discount}
                    currency={summary.currency}
                  />{" "}
                  {i18n("off")}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onRemovePromo}
              aria-label={i18n("Remove promo")}
              disabled={isPlacing}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-emerald-700 transition-colors hover:bg-emerald-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onApplyPromo();
            }}
            className="flex items-stretch gap-2"
          >
            <div className="relative min-w-0 flex-1">
              <Tag className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text-muted" />
              <Input
                type="text"
                value={promoCode}
                onChange={(e) => onPromoCodeChange(e.target.value)}
                disabled={isPlacing}
                maxLength={40}
                placeholder={i18n("Promo code")}
                className="h-11 rounded-xl border-brand-border bg-white ps-10 pe-3 text-sm font-medium uppercase tracking-wide focus-visible:border-brand-red focus-visible:ring-brand-red/30"
              />
            </div>
            <button
              type="submit"
              disabled={!deliveryAreaSelected || !promoCode.trim() || isLoading || isPlacing}
              aria-busy={isApplyingPromo}
              className="rounded-xl bg-brand-red px-4 text-sm font-semibold text-brand-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-red-hover hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-sm"
            >
              {isApplyingPromo ? <ButtonLoader label={i18n("Applying...")} /> : i18n("Apply")}
            </button>
          </form>
          {promoFeedback && (
            <p
              className={`flex items-center gap-1.5 text-xs font-medium ${
                promoFeedback.tone === "error"
                  ? "text-red-600"
                  : "text-emerald-600"
              }`}
            >
              <AlertCircle className="h-3.5 w-3.5" />
              {i18n(promoFeedback.message)}
            </p>
          )}
        </div>
      )}

      {/* Totals */}
      <div className="space-y-2.5 border-t border-dashed border-brand-border pt-4 text-sm">
        {!deliveryAreaSelected ? (
          <p className="text-gray-600">{i18n("Select a delivery area to calculate your total.")}</p>
        ) : isLoading || !summary ? (
          <div className="space-y-2.5" aria-label={i18n("Calculating totals")}>
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <SummaryRow
              label={i18n("Subtotal")}
              value={summary.subtotal}
              currency={summary.currency}
            />
            {summary.discount > 0 && appliedPromo && (
              <SummaryRow
                label={i18n("Promo ({value0})", { value0: appliedPromo })}
                value={-summary.discount}
                tone="success"
                currency={summary.currency}
              />
            )}
            <SummaryRow
              label={
                summary.isOutsideDhaka
                  ? i18n("Delivery outside Dhaka")
                  : i18n("Delivery inside Dhaka")
              }
              value={summary.shipping}
              freeLabel={summary.shipping === 0 ? "FREE" : undefined}
              currency={summary.currency}
            />
            <SummaryRow
              label={i18n("Tax ({value0}%)", { value0: Math.round(summary.taxRate * 100) })}
              value={summary.tax}
              currency={summary.currency}
            />
          </>
        )}
      </div>

      {deliveryAreaSelected && summary ? (
        <div className="rounded-2xl border border-brand-border bg-brand-light-bg p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold text-gray-700">
              {summary.currency === summary.baseCurrency
                ? i18n("Total")
                : i18n("Display total")}
            </span>
            <FormattedCurrencyAmount
              amount={summary.total}
              currency={summary.currency}
              className="text-2xl font-extrabold text-brand-red sm:text-3xl"
            />
          </div>
          {paymentMethod === "AIRWALLEX" &&
            airwallexPaymentQuote &&
            airwallexPaymentQuote.displayCurrency !==
              airwallexPaymentQuote.paymentCurrency && (
              <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-brand-border pt-3">
                <span className="text-xs font-semibold text-gray-600">
                  {i18n("Payment processed as")}</span>
                <FormattedCurrencyAmount
                  amount={airwallexPaymentQuote.paymentAmount}
                  currency={airwallexPaymentQuote.paymentCurrency}
                  className="shrink-0 text-base font-bold text-gray-900"
                />
              </div>
            )}
          {totalSaved > 0 && (
            <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
              <Sparkles className="h-3 w-3" />
              {i18n("You saved")}{" "}
              <FormattedCurrencyAmount
                amount={totalSaved}
                currency={summary.currency}
              />
            </p>
          )}
        </div>
      ) : deliveryAreaSelected ? (
        <div className="rounded-2xl border border-brand-border bg-brand-light-bg p-4">
          <div className="flex items-baseline justify-between gap-3">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-8 w-32" />
          </div>
          <Skeleton className="mt-3 h-4 w-48" />
        </div>
      ) : null}

      {submitError && (
        <p className="flex items-start gap-1.5 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs font-medium text-red-700">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {i18n(submitError)}
        </p>
      )}

      <button
        type="button"
        onClick={onPlaceOrder}
        disabled={!deliveryAreaSelected || isPlacing || isLoading || !summary}
        aria-busy={isPlacing}
        className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-red px-5 text-base font-bold text-brand-white shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-brand-red-hover hover:shadow-xl disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none disabled:hover:translate-y-0"
      >
        {isPlacing ? (
          <ButtonLoader label={buttonLabel} />
        ) : (
          <>
            <Lock className="h-4 w-4" />
            {buttonLabel}
            <ChevronRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1 rtl:rotate-180" />
          </>
        )}
      </button>
      {paymentMethod === "AIRWALLEX" && (
        <p className="-mt-1 text-center text-[11px] font-medium text-gray-600">
          {i18n("You'll continue to Airwallex's hosted checkout. SexToy never collects your card details.")}</p>
      )}

      <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-500">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
        {i18n("Pricing verified by server • Buyer protection included")}</div>
    </aside>
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
  const i18n = useInterfaceTranslations("InterfaceCheckoutComponentsOrderSummaryCard");
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
