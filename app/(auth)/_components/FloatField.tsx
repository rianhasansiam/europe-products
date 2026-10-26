"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { CheckCircle2 } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type FloatFieldProps = {
  icon: ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  maxLength?: number;
  trailing?: ReactNode;
  valid?: boolean | null;
};

export default function FloatField({
  icon,
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  maxLength,
  trailing,
  valid = null,
}: FloatFieldProps) {
  const i18n = useInterfaceTranslations("InterfaceComponentsFloatField");
  const inputId = useId();
  const [focused, setFocused] = useState(false);
  const float = focused || value.length > 0;

  const validationClass =
    valid === true
      ? "focus-within:border-success focus-within:ring-success/20"
      : valid === false
        ? "border-destructive/25 focus-within:border-destructive focus-within:ring-destructive/20"
        : "focus-within:border-primary focus-within:ring-primary/20";

  const iconClass =
    valid === true
      ? "text-success"
      : valid === false
        ? "text-destructive"
        : "text-muted-foreground group-focus-within:text-primary";

  return (
    <div
      dir={type === "email" || type === "tel" ? "ltr" : undefined}
      className={cn(
        "group relative rounded-xl border border-input bg-card shadow-sm transition-all duration-300 focus-within:ring-4",
        validationClass,
      )}
    >
      <span
        className={cn(
          "pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 transition-colors",
          iconClass,
        )}
      >
        {icon}
      </span>

      <input
        id={inputId}
        type={type}
        value={value}
        autoComplete={autoComplete}
        maxLength={maxLength}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(event) => onChange(event.target.value)}
        placeholder=" "
        className="h-12 w-full rounded-xl bg-transparent ps-9 pe-10 text-base text-foreground outline-none placeholder:text-transparent"
      />

      <label
        htmlFor={inputId}
        className={cn(
          "pointer-events-none absolute transition-all duration-200 ease-out",
          float
            ? "-top-2 start-3 bg-card px-1.5 text-[11px] font-bold uppercase tracking-wide text-foreground"
            : "start-9 top-1/2 -translate-y-1/2 text-sm font-normal normal-case tracking-normal text-muted-foreground",
        )}
      >
        {i18n(label)}
      </label>

      {trailing && (
        <span className="absolute end-2 top-1/2 -translate-y-1/2">
          {trailing}
        </span>
      )}

      {valid !== null && !trailing && <ValidationIcon valid={valid} />}
    </div>
  );
}

function ValidationIcon({ valid }: { valid: boolean }) {
  return (
    <span className="absolute end-3 top-1/2 -translate-y-1/2">
      {valid ? (
        <CheckCircle2
          className="h-4 w-4 text-success"
          style={{ animation: "pop 0.3s ease-out" }}
        />
      ) : (
        <span className="text-xs font-bold text-destructive">!</span>
      )}
    </span>
  );
}
