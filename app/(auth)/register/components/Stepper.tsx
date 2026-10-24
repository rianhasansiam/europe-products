"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

import { REGISTER_STEPS } from "./constants";
import type { RegisterStep } from "../page";

export default function Stepper({ currentStep }: { currentStep: RegisterStep }) {
  const i18n = useInterfaceTranslations("InterfaceRegisterComponentsStepper");
  return (
    <ol className="flex items-center">
      {REGISTER_STEPS.map((stepItem, index) => {
        const isCompleted = index < currentStep;
        const isActive = index === currentStep;

        return (
          <li
            key={stepItem.label}
            className="flex flex-1 items-center last:flex-none"
          >
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "relative flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-all duration-500",
                  isCompleted
                    ? "bg-brand-red text-brand-white shadow-md shadow-brand-red/30"
                    : isActive
                      ? "bg-brand-white text-brand-red ring-2 ring-brand-red"
                      : "bg-brand-light-bg text-brand-text-muted ring-1 ring-brand-border",
                )}
              >
                {isCompleted ? (
                  <Check
                    className="h-4 w-4"
                    style={{ animation: "pop 0.4s ease-out" }}
                  />
                ) : (
                  index + 1
                )}

                {isActive && (
                  <span className="absolute -inset-1 -z-10 animate-ping rounded-full bg-brand-red/30" />
                )}
              </div>

              <p
                className={cn(
                  "mt-2 hidden text-[11px] font-bold uppercase tracking-wide transition-colors sm:block",
                  isCompleted || isActive ? "text-brand-red" : "text-brand-text-muted",
                )}
              >
                {i18n(stepItem.label)}
              </p>
            </div>

            {index < REGISTER_STEPS.length - 1 && (
              <div className="relative mx-2 h-0.5 flex-1 overflow-hidden rounded-full bg-brand-border sm:mx-3">
                <div
                  className="absolute inset-y-0 start-0 bg-brand-red transition-all duration-700 ease-out"
                  style={{ width: index < currentStep ? "100%" : "0%" }}
                />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
