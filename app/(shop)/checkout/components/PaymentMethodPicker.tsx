"use client";
import { CreditCard, ShieldCheck } from "lucide-react";
import { useInterfaceTranslations } from "@/components/i18n/translate";

/** Airwallex is the store's single payment provider. */
export default function PaymentMethodPicker({ airwallexEnabled }: { airwallexEnabled: boolean }) {
  const i18n = useInterfaceTranslations("InterfaceCheckoutComponentsPaymentMethodPicker");
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-bold text-foreground">{i18n("Payment method")}</h2>
      <div className="mt-3 flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-3.5">
        <CreditCard className="h-5 w-5 text-primary" />
        <div className="flex-1">
          <p className="text-sm font-bold text-foreground">{i18n("Airwallex secure payment")}</p>
          <p className="mt-1 text-xs text-body">{i18n("Continue to Airwallex's hosted checkout to complete payment.")}</p>
          {!airwallexEnabled && <p role="status" className="mt-2 text-xs text-amber-700">{i18n("Payments are temporarily unavailable. Please try again later.")}</p>}
        </div>
        <ShieldCheck className="h-5 w-5 text-success" />
      </div>
    </section>
  );
}
