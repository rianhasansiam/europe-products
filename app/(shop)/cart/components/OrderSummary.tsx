"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import {
  ChevronRight,
  Lock,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { CurrencyAmount } from "@/components/currency/CurrencyAmount";
import { ButtonLoader } from "@/components/ui/loading";
import type { CanonicalCartSummary } from "@/features/cart/checkout-preview";

import PromoCodeInput from "./PromoCodeInput";

type AppliedPromo = {
  code: string;
  discountUSD: number;
  description: string | null;
};

type OrderSummaryProps = {
  summary: CanonicalCartSummary | null;
  fallbackSubtotalUSD: number;
  itemCount: number;
  promo: AppliedPromo | null;
  promoError: string | null;
  onApplyPromo: (code: string) => void;
  onRemovePromo: () => void;
  onPromoErrorClear: () => void;
  onCheckout: () => void;
  isApplyingPromo?: boolean;
  isCheckingOut?: boolean;
  isPricingLoading?: boolean;
  isCartSyncing?: boolean;
  isCheckoutDisabled?: boolean;
};

export default function OrderSummary({
  summary,
  fallbackSubtotalUSD,
  itemCount,
  promo,
  promoError,
  onApplyPromo,
  onRemovePromo,
  onPromoErrorClear,
  onCheckout,
  isApplyingPromo = false,
  isCheckingOut = false,
  isPricingLoading = false,
  isCartSyncing = false,
  isCheckoutDisabled = false,
}: OrderSummaryProps) {
  const i18n = useInterfaceTranslations("InterfaceCartComponentsOrderSummary");
  const verifiedSummary = isPricingLoading ? null : summary;
  const subtotalUSD = verifiedSummary?.subtotalUSD ?? fallbackSubtotalUSD;
  const totalSavedUSD = verifiedSummary?.totalSavedUSD ?? 0;

  return (
    <aside
      className="sticky top-[88px] flex min-w-0 flex-col gap-4 rounded-3xl border border-brand-border bg-brand-white p-5 shadow-sm sm:p-6"
      aria-busy={isPricingLoading || isCheckingOut || isCartSyncing}
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 sm:gap-3">
        <h2 className="min-w-0 text-lg font-bold text-gray-900">{i18n("Order Summary")}</h2>
        <span className="max-w-full rounded-full bg-brand-light-bg px-2.5 py-0.5 text-xs font-semibold text-brand-black">
          {verifiedSummary
            ? i18n("Server-priced")
            : isPricingLoading
              ? i18n("Verifying...")
              : `${itemCount} ${itemCount === 1 ? i18n("item") : i18n("items")}`}
        </span>
      </div>

      <PromoCodeInput
        applied={promo}
        onApply={onApplyPromo}
        onRemove={onRemovePromo}
        onErrorClear={onPromoErrorClear}
        error={promoError}
        isApplying={isApplyingPromo}
      />

      <div className="space-y-2.5 border-t border-dashed border-brand-border pt-4 text-sm">
        <SummaryRow label={i18n("Subtotal")} valueUSD={subtotalUSD} />
        {verifiedSummary?.discountUSD && promo ? (
          <SummaryRow
            label={i18n("Promo ({value0})", { value0: promo.code })}
            valueUSD={-verifiedSummary.discountUSD}
            tone="success"
          />
        ) : null}
        {verifiedSummary ? (
          <>
            <SummaryRow
              label={
                verifiedSummary.isOutsideDhaka
                  ? i18n("Delivery outside Dhaka")
                  : i18n("Delivery inside Dhaka")
              }
              valueUSD={verifiedSummary.shippingUSD}
              freeLabel={
                verifiedSummary.shippingUSD === 0 ? "FREE" : undefined
              }
            />
            <SummaryRow
              label={i18n("Tax ({value0}%)", { value0: Math.round(verifiedSummary.taxRate * 100) })}
              valueUSD={verifiedSummary.taxUSD}
            />
          </>
        ) : (
          <>
            <SummaryTextRow
              label={i18n("Shipping")}
              value={isPricingLoading ? "Calculating..." : "At checkout"}
            />
            <SummaryTextRow
              label={i18n("Tax")}
              value={isPricingLoading ? "Calculating..." : "At checkout"}
            />
          </>
        )}
      </div>

      <div className="rounded-2xl border border-brand-border bg-brand-light-bg p-4">
        <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2 sm:gap-3">
          <span className="text-sm font-semibold text-gray-700">
            {verifiedSummary ? i18n("Total") : i18n("Subtotal")}
          </span>
          <span className="min-w-0 text-2xl font-extrabold text-brand-red sm:text-3xl">
            <CurrencyAmount
              amountUSD={verifiedSummary?.totalUSD ?? subtotalUSD}
            />
          </span>
        </div>
        {verifiedSummary && totalSavedUSD > 0 && (
          <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
            <Sparkles className="h-3 w-3" />
            {i18n.rich("You're saving <amount></amount> today", { amount: () => <CurrencyAmount amountUSD={totalSavedUSD} /> })}</p>
        )}
        {!verifiedSummary && (
          <p className="mt-1 text-[11px] text-gray-500">
            {i18n("Shipping, tax, and promotions are verified before checkout.")}</p>
        )}
      </div>

      <button
        type="button"
        onClick={onCheckout}
        disabled={isCheckingOut || isCartSyncing || isCheckoutDisabled}
        aria-busy={isCheckingOut || isCartSyncing}
        className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-red px-5 text-base font-bold text-brand-white shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-brand-red-hover hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isCartSyncing ? (
          <ButtonLoader label={i18n("Updating cart...")} />
        ) : isCheckingOut ? (
          <ButtonLoader label={i18n("Opening checkout...")} />
        ) : isCheckoutDisabled ? (
          i18n("Select items to checkout")
        ) : (
          <>
            <Lock className="h-4 w-4" />
            {i18n("Secure Checkout")}<ChevronRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1 rtl:rotate-180" />
          </>
        )}
      </button>

      <div className="flex min-w-0 flex-wrap items-center justify-center gap-1.5 text-center text-[11px] text-gray-500">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
        <span className="min-w-0 break-words">
          {i18n("Pricing verified by server · Buyer protection included")}</span>
      </div>
    </aside>
  );
}

function SummaryTextRow({ label, value }: { label: string; value: string }) {
  const i18n = useInterfaceTranslations("InterfaceCartComponentsOrderSummary");
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-gray-600">{i18n(label)}</span>
      <span className="font-semibold text-gray-500">{value}</span>
    </div>
  );
}

function SummaryRow({
  label,
  valueUSD,
  tone = "default",
  freeLabel,
}: {
  label: string;
  valueUSD: number;
  tone?: "default" | "success";
  freeLabel?: string;
}) {
  const i18n = useInterfaceTranslations("InterfaceCartComponentsOrderSummary");
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
        <span
          className={`shrink-0 text-end font-semibold ${
            tone === "success" ? "text-emerald-600" : "text-gray-900"
          }`}
        >
          {valueUSD < 0 ? "-" : null}
          <CurrencyAmount amountUSD={Math.abs(valueUSD)} />
        </span>
      )}
    </div>
  );
}
