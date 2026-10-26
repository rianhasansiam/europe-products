"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { Minus, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type QuantityStepperProps = {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  size?: "sm" | "md";
};

export default function QuantityStepper({
  value,
  min = 1,
  max = 99,
  onChange,
  size = "md",
}: QuantityStepperProps) {
  const i18n = useInterfaceTranslations("InterfaceCartComponentsQuantityStepper");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [draftValue, setDraftValue] = useState(String(value));

  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setDraftValue(String(value));
    }
  }, [value]);

  const normalizedDraft = () => {
    const parsed = Number.parseInt(draftValue, 10);
    return Math.max(min, Math.min(max, Number.isFinite(parsed) ? parsed : value));
  };

  const commitDraft = () => {
    const next = normalizedDraft();
    setDraftValue(String(next));
    if (next !== value) onChange(next);
  };

  const changeBy = (delta: number) => {
    const next = Math.max(min, Math.min(max, normalizedDraft() + delta));
    setDraftValue(String(next));
    if (next !== value) onChange(next);
  };

  const draftQuantity = normalizedDraft();

  const buttonClasses = cn(
    "grid place-items-center rounded-lg text-foreground transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring hover:bg-secondary hover:text-primary disabled:cursor-not-allowed disabled:text-muted-foreground disabled:hover:bg-transparent",
    size === "sm" ? "h-10 w-10" : "h-11 w-11",
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        "inline-flex items-center gap-1 rounded-xl border border-border bg-muted p-1",
        size === "sm" ? "text-xs" : "text-sm",
      )}
    >
      <button
        type="button"
        onClick={() => changeBy(-1)}
        disabled={draftQuantity <= min}
        aria-label={i18n("Decrease quantity")}
        className={buttonClasses}
      >
        <Minus className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      </button>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        aria-label={i18n("Quantity")}
        role="spinbutton"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={draftQuantity}
        value={draftValue}
        onChange={(event) => {
          setDraftValue(event.target.value.replace(/\D/g, ""));
        }}
        onBlur={(event) => {
          if (
            event.relatedTarget instanceof Node &&
            containerRef.current?.contains(event.relatedTarget)
          ) {
            return;
          }
          commitDraft();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            inputRef.current?.blur();
          } else if (event.key === "Escape") {
            event.preventDefault();
            setDraftValue(String(value));
            inputRef.current?.blur();
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            changeBy(1);
          } else if (event.key === "ArrowDown") {
            event.preventDefault();
            changeBy(-1);
          }
        }}
        onFocus={(event) => event.currentTarget.select()}
        className={cn(
          "bg-transparent text-center font-bold text-foreground outline-none focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-primary/30",
          size === "sm" ? "w-8 text-xs" : "w-10 text-sm",
        )}
      />
      <button
        type="button"
        onClick={() => changeBy(1)}
        disabled={draftQuantity >= max}
        aria-label={i18n("Increase quantity")}
        className={buttonClasses}
      >
        <Plus className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      </button>
    </div>
  );
}
