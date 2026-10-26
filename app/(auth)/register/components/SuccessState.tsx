"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import Link from "@/lib/i18n/navigation";
import { ArrowRight, CheckCircle2 } from "lucide-react";

type SuccessStateProps = {
  name: string;
};

export default function SuccessState({ name }: SuccessStateProps) {
  const i18n = useInterfaceTranslations("InterfaceRegisterComponentsSuccessState");
  const firstName = name.trim().split(" ")[0];

  return (
    <div
      className="flex flex-col items-center py-8 text-center"
      style={{ animation: "pop 0.6s ease-out" }}
    >
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-emerald-400/40" />

        <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg">
          <CheckCircle2 className="h-10 w-10" />
        </div>
      </div>

      <h3 className="mt-6 text-2xl font-bold tracking-tight text-foreground">
        {i18n("Welcome aboard")}{firstName ? `, ${firstName}` : ""}!
      </h3>

      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {i18n("Your account is ready. Let's find some great deals from stores near you.")}</p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/products"
          className="inline-flex items-center gap-2 min-h-11 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-colors hover:bg-primary-hover"
        >
          {i18n("Start shopping")}<ArrowRight className="h-4 w-4 rtl:rotate-180" />
        </Link>

        <Link
          href="/"
          className="inline-flex items-center gap-2 min-h-11 rounded-xl border border-border bg-card px-6 py-2.5 text-sm font-bold text-foreground transition-colors hover:border-primary hover:text-primary"
        >
          {i18n("Go home")}</Link>
      </div>
    </div>
  );
}
