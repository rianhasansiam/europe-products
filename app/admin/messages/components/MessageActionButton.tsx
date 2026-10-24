"use client";

import type React from "react";

import { LoadingSpinner } from "@/components/ui/loading";
import { cn } from "@/lib/utils";

export type ActionTone = "emerald" | "amber" | "red";

const ACTION_TONE: Record<ActionTone, string> = {
  emerald: "border-emerald-200 text-emerald-700 hover:bg-emerald-50",
  amber: "border-amber-200 text-amber-700 hover:bg-amber-50",
  red: "border-red-200 text-red-700 hover:bg-red-50",
};

export default function MessageActionButton({
  tone,
  busy,
  onClick,
  icon,
  label,
}: {
  tone: ActionTone;
  busy: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-busy={busy}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
        ACTION_TONE[tone],
      )}
    >
      {busy ? <LoadingSpinner decorative size="sm" /> : icon}
      {label}
    </button>
  );
}
