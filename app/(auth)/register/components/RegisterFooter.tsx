"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";

import { REGISTER_STEPS } from "./constants";
import type { RegisterStatus, RegisterStep } from "../page";
import { ButtonLoader } from "@/components/ui/loading";

type RegisterFooterProps = {
  currentStep: RegisterStep;
  status: RegisterStatus;
  canContinue: boolean;
  onBack: () => void;
  onNext: () => void;
};

export default function RegisterFooter({
  currentStep,
  status,
  canContinue,
  onBack,
  onNext,
}: RegisterFooterProps) {
  const i18n = useInterfaceTranslations("InterfaceRegisterComponentsRegisterFooter");
  const isSubmitting = status === "submitting";
  const isLastStep = currentStep === REGISTER_STEPS.length - 1;

  return (
    <div className="mt-7 flex flex-col-reverse items-stretch gap-2 min-[380px]:flex-row min-[380px]:items-center min-[380px]:justify-between min-[380px]:gap-3">
      <button
        type="button"
        onClick={onBack}
        disabled={currentStep === 0 || isSubmitting}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-muted-foreground transition-all hover:-translate-x-0.5 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-x-0 min-[380px]:w-auto"
      >
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        {i18n("Back")}</button>

      <button
        type="button"
        onClick={onNext}
        disabled={!canContinue || isSubmitting}
        aria-busy={isSubmitting}
        className="group relative inline-flex w-full items-center justify-center gap-2 overflow-hidden min-h-11 rounded-xl bg-primary px-7 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-colors duration-200 hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none disabled:hover:translate-y-0 min-[380px]:w-auto"
      >

        {isSubmitting ? (
          <ButtonLoader label={i18n("Creating account...")} />
        ) : isLastStep ? (
          <>
            {i18n("Create account")}<CheckCircle2 className="h-4 w-4 transition-transform " />
          </>
        ) : (
          <>
            {i18n("Continue")}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" />
          </>
        )}
      </button>
    </div>
  );
}
