"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type StepPanelProps = {
  active: boolean;
  children: ReactNode;
};

export default function StepPanel({ active, children }: StepPanelProps) {
  return (
    <div
      className={cn(
        "grid gap-4 transition-all duration-500 ease-out",
        active
          ? "translate-y-0 opacity-100"
          : "pointer-events-none absolute inset-0 -translate-y-3 opacity-0",
      )}
      aria-hidden={!active}
    >
      {children}
    </div>
  );
}
