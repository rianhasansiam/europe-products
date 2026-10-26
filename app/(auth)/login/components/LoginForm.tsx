"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import Link from "@/lib/i18n/navigation";
import { ArrowRight, Lock, LogIn, Mail, ShieldAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import { FIELD_LIMITS } from "@/lib/auth/policy";

import FloatField from "@/app/(auth)/_components/FloatField";
import {
  GoogleSignInButton,
  SocialDivider,
} from "@/app/(auth)/_components/GoogleSignInButton";
import PasswordVisibilityButton from "@/app/(auth)/_components/PasswordVisibilityButton";
import { ButtonLoader } from "@/components/ui/loading";

import type { LoginFieldUpdater, LoginForm, LoginStatus } from "../page";

type LoginFormProps = {
  form: LoginForm;
  status: LoginStatus;
  emailValid: boolean;
  canSubmit: boolean;
  showPassword: boolean;
  errorMessage: string | null;
  callbackUrl?: string;
  onFieldChange: LoginFieldUpdater;
  onTogglePassword: () => void;
  onSubmit: () => void;
};

export default function LoginFormView({
  form,
  status,
  emailValid,
  canSubmit,
  showPassword,
  errorMessage,
  callbackUrl,
  onFieldChange,
  onTogglePassword,
  onSubmit,
}: LoginFormProps) {
  const i18n = useInterfaceTranslations("InterfaceLoginComponentsLoginForm");
  const isSubmitting = status === "submitting";
  const isError = status === "error";

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className={cn(
        "mt-6 grid gap-4",
        isError && "animate-[shake_0.4s_ease-in-out]",
      )}
      noValidate
    >
      {errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-xs text-destructive"
        >
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="leading-relaxed">{i18n(errorMessage)}</span>
        </div>
      )}

      <FloatField
        icon={<Mail className="h-4 w-4" />}
        label={i18n("Email address")}
        value={form.email}
        onChange={(value) => onFieldChange("email", value)}
        type="email"
        autoComplete="email"
        maxLength={FIELD_LIMITS.EMAIL_MAX}
        valid={form.email.length > 0 ? emailValid : null}
      />

      <FloatField
        icon={<Lock className="h-4 w-4" />}
        label={i18n("Password")}
        value={form.password}
        onChange={(value) => onFieldChange("password", value)}
        type={showPassword ? "text" : "password"}
        autoComplete="current-password"
        maxLength={FIELD_LIMITS.PASSWORD_MAX}
        trailing={
          <PasswordVisibilityButton
            visible={showPassword}
            onClick={onTogglePassword}
          />
        }
      />

      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        <Link
          href="/login"
          className="text-xs font-semibold text-primary underline-offset-2 hover:underline"
        >
          {i18n("Forgot password?")}</Link>
      </div>

      <button
        type="submit"
        disabled={!canSubmit || isSubmitting}
        aria-busy={isSubmitting}
        className="group relative mt-2 inline-flex items-center justify-center gap-2 overflow-hidden min-h-11 rounded-xl bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground shadow-md transition-colors duration-200 hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none disabled:hover:translate-y-0"
      >

        {isSubmitting ? (
          <ButtonLoader label={i18n("Signing you in...")} />
        ) : (
          <>
            <LogIn className="h-4 w-4" />
            {i18n("Sign in")}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" />
          </>
        )}
      </button>

      <SocialDivider />
      <GoogleSignInButton callbackUrl={callbackUrl} />

      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        {i18n("By signing in you agree to our")}{" "}
        <Link
          href="/terms-and-conditions"
          className="font-semibold text-primary hover:underline"
        >
          {i18n("Terms")}</Link>{" "}
        {i18n("and")}{" "}
        <Link
          href="/privacy-policy"
          className="font-semibold text-primary hover:underline"
        >
          {i18n("Privacy Policy")}</Link>
        .
      </p>
    </form>
  );
}
