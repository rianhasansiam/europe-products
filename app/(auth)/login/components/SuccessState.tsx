"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import Link from "@/lib/i18n/navigation";
import { ArrowRight, CheckCircle2 } from "lucide-react";

type SuccessStateProps = {
  email: string;
};

export default function SuccessState({ email }: SuccessStateProps) {
  const i18n = useInterfaceTranslations("InterfaceLoginComponentsSuccessState");
  return (
    <div
      className="flex flex-col items-center py-8 text-center"
      style={{ animation: "pop 0.6s ease-out" }}
    >
      <div className="relative">
        <div className="absolute inset-0 animate-ping rounded-full bg-emerald-400/40" />

        <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-linear-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/40">
          <CheckCircle2 className="h-10 w-10" />
        </div>
      </div>

      <h3 className="mt-6 text-2xl font-black tracking-tight text-brand-text-dark">
        {i18n("You're signed in")}</h3>

      <p className="mt-2 max-w-sm text-sm text-brand-text-muted">
        {email
          ? i18n("Welcome back, {value0}. Pick up right where you left off.", { value0: email })
          : i18n("Welcome back. Pick up right where you left off.")}
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/products"
          className="inline-flex items-center gap-2 rounded-full bg-brand-red px-6 py-2.5 text-sm font-bold text-brand-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-brand-red-hover hover:shadow-lg"
        >
          {i18n("Continue shopping")}<ArrowRight className="h-4 w-4 rtl:rotate-180" />
        </Link>

        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-brand-border bg-white px-6 py-2.5 text-sm font-bold text-brand-text-dark transition-all hover:-translate-y-0.5 hover:border-brand-red hover:text-brand-red"
        >
          {i18n("Go home")}</Link>
      </div>
    </div>
  );
}
