"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import Link from "@/lib/i18n/navigation";

import { REGISTER_STEPS } from "./constants";
import Stepper from "./Stepper";
import type { RegisterStep } from "../page";

type RegisterHeaderProps = {
  currentStep: RegisterStep;
};

export default function RegisterHeader({ currentStep }: RegisterHeaderProps) {
  const i18n = useInterfaceTranslations("InterfaceRegisterComponentsRegisterHeader");
  return (
    <header className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-brand-text-dark sm:text-3xl">
            {i18n.rich("Create your <highlight>account</highlight>", { highlight: (chunks) => <span className="text-brand-red">{chunks}</span> })}
          </h2>

          <p className="mt-1 text-sm text-brand-text-muted">
            {i18n("Already a member?")}{" "}
            <Link
              href="/login"
              className="font-semibold text-brand-red underline-offset-2 hover:underline"
            >
              {i18n("Sign in")}</Link>
          </p>
        </div>

        <span className="hidden shrink-0 rounded-full bg-brand-red/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-brand-red ring-1 ring-brand-red/20 sm:inline-flex">
          {i18n("Step {current, number} of {total, number}", { current: currentStep + 1, total: REGISTER_STEPS.length })}
        </span>
      </div>

      <Stepper currentStep={currentStep} />
    </header>
  );
}
