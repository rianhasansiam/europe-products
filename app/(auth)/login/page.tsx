"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { Suspense, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/lib/i18n/navigation";
import { signIn } from "next-auth/react";

import AuthAnimations from "@/app/(auth)/_components/AuthAnimations";
import AuthBackground from "@/app/(auth)/_components/AuthBackground";
import BrandPanel from "@/app/(auth)/_components/BrandPanel";
import { useAutoRotatingIndex } from "@/app/(auth)/_components/useAutoRotatingIndex";
import { FIELD_LIMITS, EMAIL_REGEX } from "@/lib/auth/policy";

import LoginFormView from "./components/LoginForm";
import LoginHeader from "./components/LoginHeader";
import SuccessState from "./components/SuccessState";
import { BRAND_PERKS, BRAND_STATS, INITIAL_FORM } from "./components/constants";

export type LoginStatus = "idle" | "submitting" | "error" | "success";

export type LoginForm = {
  email: string;
  password: string;
};

export type LoginFieldUpdater = <Field extends keyof LoginForm>(
  field: Field,
  value: LoginForm[Field],
) => void;

const DEFAULT_REDIRECT = "/";
const GENERIC_LOGIN_ERROR = "Invalid email or password. Please try again.";
const CALLBACK_BASE_URL = "https://sextoybd.net";

function getSafeCallbackUrl(value: string | null): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    return DEFAULT_REDIRECT;
  }

  try {
    const url = new URL(value, CALLBACK_BASE_URL);
    if (url.origin !== CALLBACK_BASE_URL) return DEFAULT_REDIRECT;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_REDIRECT;
  }
}

/**
 * The page is wrapped in Suspense because `useSearchParams` opts the route
 * out of static prerendering unless its consumer sits inside a Suspense
 * boundary (Next 16 strict bailout). The fallback is intentionally empty —
 * it shows for one frame on the client only, since this route is dynamic.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const i18n = useInterfaceTranslations("InterfaceLoginPage");
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = getSafeCallbackUrl(searchParams.get("callbackUrl"));

  const [form, setForm] = useState<LoginForm>(INITIAL_FORM);
  const [status, setStatus] = useState<LoginStatus>("idle");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Synchronous guard: React state updates are async, so a fast double-click
  // can fire two requests in the same tick. A ref flips immediately.
  const inFlightRef = useRef(false);

  const [activePerkIndex, setActivePerkIndex] = useAutoRotatingIndex(
    BRAND_PERKS.length,
    3500,
  );

  const emailValid = useMemo(
    () => EMAIL_REGEX.test(form.email),
    [form.email],
  );
  const canSubmit =
    emailValid &&
    form.password.length >= 1 &&
    form.password.length <= FIELD_LIMITS.PASSWORD_MAX;

  const isSubmitting = status === "submitting";
  const isSuccess = status === "success";

  const updateField = <Field extends keyof LoginForm>(
    field: Field,
    value: LoginForm[Field],
  ) => {
    setForm((previousForm) => ({ ...previousForm, [field]: value }));
    if (status === "error") {
      setStatus("idle");
      setErrorMessage(null);
    }
  };

  const handleSubmit = async () => {
    if (inFlightRef.current) return;
    if (!canSubmit) return;

    inFlightRef.current = true;
    setStatus("submitting");
    setErrorMessage(null);

    try {
      const response = await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
      });

      if (!response || response.error) {
        // Always show the same generic message regardless of the underlying
        // failure (wrong password, no such user, rate-limited).
        setStatus("error");
        setErrorMessage(GENERIC_LOGIN_ERROR);
        return;
      }

      setStatus("success");
      router.refresh();
      router.push(callbackUrl);
    } catch (error) {
      console.error("Login failed", error);
      setStatus("error");
      setErrorMessage(GENERIC_LOGIN_ERROR);
    } finally {
      inFlightRef.current = false;
    }
  };

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-brand-light-bg">
      <AuthBackground />

      <section className="relative z-10 mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 py-8 sm:px-6 lg:grid-cols-12 lg:gap-8 lg:py-12">
        <BrandPanel
          badgeText={i18n("SexToy · Sign in")}
          headlineLead={i18n("Welcome back to")}
          headlineEmphasis={i18n("SexToy.")}
          subheading={i18n("Sign in to keep shopping where you left off, with deals from premium stores in your neighborhood.")}
          perks={BRAND_PERKS}
          stats={BRAND_STATS}
          activePerkIndex={activePerkIndex}
          onSelectPerk={setActivePerkIndex}
        />

        <section className="lg:col-span-7">
          <div className="relative overflow-hidden rounded-3xl bg-white p-6 shadow-xl ring-1 ring-brand-border sm:p-9">
            <div className="pointer-events-none absolute -top-px start-0 h-1 w-full bg-brand-red" />

            <LoginHeader />

            {isSuccess ? (
              <div className="mt-6">
                <SuccessState email={form.email} />
              </div>
            ) : (
              <LoginFormView
                form={form}
                status={status}
                emailValid={emailValid}
                canSubmit={canSubmit && !isSubmitting}
                showPassword={showPassword}
                errorMessage={errorMessage}
                callbackUrl={callbackUrl}
                onFieldChange={updateField}
                onTogglePassword={() => setShowPassword((value) => !value)}
                onSubmit={handleSubmit}
              />
            )}
          </div>
        </section>
      </section>

      <AuthAnimations />
    </main>
  );
}
