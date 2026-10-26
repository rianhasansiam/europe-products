"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

import type { PasswordScore } from "../page";

type PasswordStrengthMeterProps = {
  password: string;
  score: PasswordScore;
  label: string;
  colorClass: string;
};

export default function PasswordStrengthMeter({
  password,
  score,
  label,
  colorClass,
}: PasswordStrengthMeterProps) {
  const i18n = useInterfaceTranslations("InterfaceRegisterComponentsPasswordStrengthMeter");
  return (
    <div>
      <div className="flex gap-1.5">
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-all duration-500",
              index < score ? colorClass : "bg-border",
            )}
          />
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px]">
        <span className="font-bold uppercase tracking-wide text-muted-foreground">
          {i18n("Strength")}</span>

        <span
          className={cn(
            "font-bold",
            score >= 3
              ? "text-success"
              : score >= 2
                ? "text-yellow-600"
                : "text-destructive",
          )}
        >
          {password ? i18n(label) : "—"}
        </span>
      </div>

      <PasswordHints password={password} />
    </div>
  );
}

function PasswordHints({ password }: { password: string }) {
  const i18n = useInterfaceTranslations("InterfaceRegisterComponentsPasswordStrengthMeter");
  const checks = [
    { label: i18n("8+ characters"), passed: password.length >= 8 },
    { label: i18n("Uppercase"), passed: /[A-Z]/.test(password) },
    { label: i18n("Number"), passed: /\d/.test(password) },
    { label: i18n("Symbol"), passed: /[^A-Za-z0-9]/.test(password) },
  ];

  return (
    <ul className="mt-3 grid grid-cols-2 gap-1.5">
      {checks.map((check) => (
        <li
          key={check.label}
          className={cn(
            "flex items-center gap-1.5 text-[11px] transition-colors",
            check.passed ? "text-success" : "text-muted-foreground",
          )}
        >
          <span
            className={cn(
              "flex h-4 w-4 items-center justify-center rounded-full transition-all duration-300",
              check.passed
                ? "bg-success-surface0 text-white"
                : "bg-border text-muted-foreground",
            )}
          >
            <Check className="h-3 w-3" />
          </span>

          {i18n(check.label)}
        </li>
      ))}
    </ul>
  );
}
