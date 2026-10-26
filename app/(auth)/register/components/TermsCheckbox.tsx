"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import Link from "@/lib/i18n/navigation";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

type TermsCheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export default function TermsCheckbox({
  checked,
  onChange,
}: TermsCheckboxProps) {
  const i18n = useInterfaceTranslations("InterfaceRegisterComponentsTermsCheckbox");
  return (
    <label className="group flex cursor-pointer select-none items-start gap-3 rounded-xl border border-border bg-muted p-3 transition-colors hover:bg-primary/5">
      <span className="relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-border bg-card transition-colors group-hover:border-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="peer absolute inset-0 cursor-pointer opacity-0"
        />

        <Check
          className={cn(
            "relative z-10 h-3.5 w-3.5 text-white transition-all duration-200",
            checked ? "scale-100 opacity-100" : "scale-50 opacity-0",
          )}
        />

        <span
          className={cn(
            "absolute inset-0 z-0 rounded-md bg-primary transition-opacity duration-200",
            checked ? "opacity-100" : "opacity-0",
          )}
        />
      </span>

      <span className="text-xs leading-relaxed text-foreground">
        {i18n("I agree to the")}{" "}
        <Link
          href="/terms-and-conditions"
          className="font-semibold text-primary hover:underline"
        >
          {i18n("Terms of Service")}</Link>{" "}
        {i18n("and")}{" "}
        <Link
          href="/privacy-policy"
          className="font-semibold text-primary hover:underline"
        >
          {i18n("Privacy Policy")}</Link>
        {i18n(". I'd like to receive deals and updates.")}</span>
    </label>
  );
}
