"use client";
import { CreditCard, ShieldCheck } from "lucide-react";
import { useInterfaceTranslations } from "@/components/i18n/translate";

/** Airwallex is the store's single payment provider. */
export default function PaymentMethodPicker({ airwallexEnabled }: { airwallexEnabled: boolean }) {
  const i18n = useInterfaceTranslations("InterfaceCheckoutComponentsPaymentMethodPicker");
  return (
    <section className="rounded-3xl border border-brand-border bg-brand-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-bold text-gray-900">{i18n("Payment method")}</h2>
      <div className="mt-3 flex items-center gap-3 rounded-2xl border border-brand-red/30 bg-brand-red/5 p-3.5">
        <CreditCard className="h-5 w-5 text-brand-red" />
        <div className="flex-1">
          <p className="text-sm font-bold text-gray-900">{i18n("Airwallex secure payment")}</p>
          <p className="mt-1 text-xs text-gray-600">{i18n("Continue to Airwallex's hosted checkout to complete payment.")}</p>
          {!airwallexEnabled && <p role="status" className="mt-2 text-xs text-amber-700">{i18n("Payments are temporarily unavailable. Please try again later.")}</p>}
        </div>
        <ShieldCheck className="h-5 w-5 text-emerald-600" />
      </div>
    </section>
  );
}
