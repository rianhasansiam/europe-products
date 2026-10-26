"use client";
import { useLocaleDraft, useLocaleSwitchGuard } from "@/components/i18n/useLocaleDraft";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { useRef, useState } from "react";
import { useRouter } from "@/lib/i18n/navigation";
import { signIn } from "next-auth/react";

import AuthAnimations from "@/app/(auth)/_components/AuthAnimations";
import AuthBackground from "@/app/(auth)/_components/AuthBackground";
import BrandPanel from "@/app/(auth)/_components/BrandPanel";
import { useAutoRotatingIndex } from "@/app/(auth)/_components/useAutoRotatingIndex";

import AccountStep from "./components/AccountStep";
import ProfileStep from "./components/ProfileStep";
import RegisterFooter from "./components/RegisterFooter";
import RegisterHeader from "./components/RegisterHeader";
import SecurityStep from "./components/SecurityStep";
import StepPanel from "./components/StepPanel";
import SuccessState from "./components/SuccessState";
import {
  BRAND_PERKS,
  BRAND_STATS,
  INITIAL_FORM,
  REGISTER_STEPS,
} from "./components/constants";
import { useRegisterValidation } from "./components/hooks";

export type RegisterStep = 0 | 1 | 2;

export type RegisterStatus = "idle" | "submitting" | "success";

export type RegisterForm = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
  city: string;
  agreeToTerms: boolean;
};

export type PasswordScore = 0 | 1 | 2 | 3 | 4;

export type PasswordField = "password" | "confirmPassword";

export type FieldUpdater = <Field extends keyof RegisterForm>(
  field: Field,
  value: RegisterForm[Field],
) => void;

type RegisterApiError = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

const GENERIC_REGISTER_ERROR =
  "We couldn't create your account. Please try again.";

export default function RegisterPage() {
  const i18n = useInterfaceTranslations("InterfaceRegisterPage");
  const router = useRouter();

  const [currentStep, setCurrentStep] = useState<RegisterStep>(0);
  const [status, setStatus] = useState<RegisterStatus>("idle");
  const [form, setForm] = useState<RegisterForm>(INITIAL_FORM);
  useLocaleDraft("register-profile", form, setForm, ["name", "email", "phone", "city", "agreeToTerms"]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [visiblePasswordField, setVisiblePasswordField] =
    useState<PasswordField | null>(null);

  // Synchronous guard against double-submits.
  const inFlightRef = useRef(false);

  const [activePerkIndex, setActivePerkIndex] = useAutoRotatingIndex(
    BRAND_PERKS.length,
    3500,
  );

  const validation = useRegisterValidation(form, currentStep);

  const isLastStep = currentStep === REGISTER_STEPS.length - 1;
  const isSubmitting = status === "submitting";
  useLocaleSwitchGuard(isSubmitting);

  const updateField = <Field extends keyof RegisterForm>(
    field: Field,
    value: RegisterForm[Field],
  ) => {
    setForm((previousForm) => ({ ...previousForm, [field]: value }));
    if (errorMessage) setErrorMessage(null);
  };

  const goToPreviousStep = () => {
    setCurrentStep((step) =>
      step === 0 ? step : ((step - 1) as RegisterStep),
    );
  };

  const goToNextStep = () => {
    setCurrentStep((step) =>
      step >= REGISTER_STEPS.length - 1
        ? step
        : ((step + 1) as RegisterStep),
    );
  };

  const handleSubmit = async () => {
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    setStatus("submitting");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as
          | RegisterApiError
          | null;

        const firstFieldError = data?.fieldErrors
          ? Object.values(data.fieldErrors).flat().filter(Boolean)[0]
          : undefined;

        setErrorMessage(
          firstFieldError ?? data?.error ?? GENERIC_REGISTER_ERROR,
        );
        setStatus("idle");
        return;
      }

      // Auto sign-in so the success screen reflects a real session.
      await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
      });

      router.refresh();
      setStatus("success");
    } catch (error) {
      console.error("Registration failed", error);
      setErrorMessage(GENERIC_REGISTER_ERROR);
      setStatus("idle");
    } finally {
      inFlightRef.current = false;
    }
  };

  const handleNextAction = () => {
    if (!validation.canContinue || isSubmitting) return;

    if (!isLastStep) {
      goToNextStep();
      return;
    }

    handleSubmit();
  };

  return (
    <main data-locale-recoverable className="relative isolate min-h-screen overflow-hidden bg-background">
      <AuthBackground />

      <section className="relative z-10 mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 py-8 sm:px-6 lg:grid-cols-12 lg:gap-8 lg:py-12">
        <BrandPanel
          badgeText={i18n("SexToy · Welcome")}
          headlineLead={i18n("Join the local")}
          headlineEmphasis={i18n("shopping revolution.")}
          subheading={i18n("Create your account in under a minute and start unlocking deals from premium stores in your neighborhood.")}
          perks={BRAND_PERKS}
          stats={BRAND_STATS}
          activePerkIndex={activePerkIndex}
          onSelectPerk={setActivePerkIndex}
        />

        <section className="lg:col-span-7">
          <div className="relative overflow-hidden rounded-3xl bg-card p-6 shadow-xl ring-1 ring-border sm:p-9">
            <div className="pointer-events-none absolute -top-px start-0 h-1 w-full bg-primary" />

            <RegisterHeader currentStep={currentStep} />

            <div className="mt-7">
              {status === "success" ? (
                <SuccessState name={form.name} />
              ) : (
                <div className="relative">
                  {errorMessage && (
                    <div
                      role="alert"
                      className="mb-4 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-xs text-destructive"
                    >
                      {i18n(errorMessage)}
                    </div>
                  )}

                  <StepPanel active={currentStep === 0}>
                    <AccountStep
                      form={form}
                      emailValid={validation.emailValid}
                      onFieldChange={updateField}
                    />
                  </StepPanel>

                  <StepPanel active={currentStep === 1}>
                    <SecurityStep
                      form={form}
                      passwordScore={validation.passwordScore}
                      passwordLabel={validation.passwordLabel}
                      passwordColorClass={validation.passwordColorClass}
                      visiblePasswordField={visiblePasswordField}
                      onFieldChange={updateField}
                      onTogglePassword={setVisiblePasswordField}
                    />
                  </StepPanel>

                  <StepPanel active={currentStep === 2}>
                    <ProfileStep form={form} onFieldChange={updateField} />
                  </StepPanel>
                </div>
              )}
            </div>

            {status !== "success" && (
              <RegisterFooter
                currentStep={currentStep}
                status={status}
                canContinue={validation.canContinue && !isSubmitting}
                onBack={goToPreviousStep}
                onNext={handleNextAction}
              />
            )}
          </div>
        </section>
      </section>

      <AuthAnimations />
    </main>
  );
}
