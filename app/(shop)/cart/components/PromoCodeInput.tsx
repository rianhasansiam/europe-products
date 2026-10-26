"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { useState } from "react";
import { AlertCircle, Check, Tag, X } from "lucide-react";

import { CurrencyAmount } from "@/components/currency/CurrencyAmount";
import { Input } from "@/components/ui/input";

type AppliedPromo = {
  code: string;
  discountUSD: number;
  description: string | null;
};

type PromoCodeInputProps = {
  applied: AppliedPromo | null;
  onApply: (code: string) => void;
  onRemove: () => void;
  onErrorClear: () => void;
  error: string | null;
  isApplying?: boolean;
};

export default function PromoCodeInput({
  applied,
  onApply,
  onRemove,
  onErrorClear,
  error,
  isApplying = false,
}: PromoCodeInputProps) {
  const i18n = useInterfaceTranslations("InterfaceCartComponentsPromoCodeInput");
  const [value, setValue] = useState("");

  const handleApply = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = value.trim().toUpperCase();
    if (!trimmed) return;
    onApply(trimmed);
  };

  if (applied) {
    return (
      <div className="rounded-2xl border border-success/25 bg-success-surface px-3 py-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-success-surface0 text-white">
            <Check className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex min-w-0 items-center gap-1.5 text-sm font-bold text-success">
              <span
                title={applied.code}
                className="min-w-0 flex-1 truncate rounded-md bg-card px-1.5 py-0.5 font-mono text-xs text-success"
              >
                {applied.code}
              </span>
              <span className="shrink-0">{i18n("applied")}</span>
            </p>
            <p className="truncate text-xs text-success">
              {isApplying ? (
                i18n("Revalidating discount...")
              ) : (
                <>
                  {applied.description ? `${applied.description} · ` : ""}
                  -<CurrencyAmount amountUSD={applied.discountUSD} />
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onRemove}
            aria-label={i18n("Remove promo code")}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-success transition-colors hover:bg-success/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <form onSubmit={handleApply} className="flex items-stretch gap-2">
        <div className="relative min-w-0 flex-1">
          <Tag className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              if (error) onErrorClear();
            }}
            disabled={isApplying}
            maxLength={40}
            aria-label={i18n("Promo code")}
            aria-invalid={Boolean(error)}
            placeholder={i18n("Promo code")}
            className="h-11 rounded-xl border-input bg-card ps-10 pe-3 text-base font-medium uppercase tracking-wide focus-visible:border-primary focus-visible:ring-primary/30"
          />
        </div>
        <button
          type="submit"
          disabled={!value.trim() || isApplying}
          aria-busy={isApplying}
          className="rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors duration-200 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-sm"
        >
          {isApplying ? i18n("Applying...") : i18n("Apply")}
        </button>
      </form>
      {error && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-destructive">
          <AlertCircle className="h-3.5 w-3.5" />
          {i18n(error)}
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">
        {i18n("Promo availability and discount are verified by the checkout service.")}</p>
    </div>
  );
}
