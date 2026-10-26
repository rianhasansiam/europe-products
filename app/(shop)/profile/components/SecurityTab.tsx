"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";

import { toast } from "@/lib/feedback";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Lock,
  ShieldCheck,
} from "lucide-react";

import {
  changePasswordOnServer,
  type ProfileUser,
} from "@/features/profile/api";
import { FIELD_LIMITS, meetsPasswordPolicy } from "@/lib/auth/policy";

import FloatField from "@/app/(auth)/_components/FloatField";
import PasswordVisibilityButton from "@/app/(auth)/_components/PasswordVisibilityButton";
import { ButtonLoader } from "@/components/ui/loading";

type SecurityTabProps = {
  user: ProfileUser;
};

type FormState = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type SubmitState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "success"; firstTime: boolean }
  | { status: "error"; message: string };

const EMPTY_FORM: FormState = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

/**
 * "Security" tab — change password / set first password.
 *
 * Google-only accounts (no `password` set yet) are nudged to add a
 * password as a fallback sign-in method. The same endpoint handles
 * both the "change" and "set initial" flows; the UI just adapts the
 * copy and hides the current-password field for first-time setters.
 */
export default function SecurityTab({ user }: SecurityTabProps) {
  const i18n = useInterfaceTranslations("InterfaceProfileComponentsSecurityTab");
  const isGoogleOnly = user.provider === "GOOGLE";
  // We don't actually know server-side whether the user has a password
  // already (we'd need an extra round-trip to find out), but a Google
  // account that hasn't signed in via credentials before always lacks
  // one. The endpoint will tell us in the success payload.
  const [hasPassword, setHasPassword] = useState<boolean>(!isGoogleOnly);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitState, setSubmitState] = useState<SubmitState>({
    status: "idle",
  });
  const [show, setShow] = useState({
    current: false,
    next: false,
    confirm: false,
  });

  const newPasswordValid = useMemo(() => {
    if (form.newPassword.length === 0) return null;
    return meetsPasswordPolicy(form.newPassword);
  }, [form.newPassword]);

  const confirmValid = useMemo(() => {
    if (form.confirmPassword.length === 0) return null;
    return form.confirmPassword === form.newPassword;
  }, [form.confirmPassword, form.newPassword]);

  const currentValid = useMemo(() => {
    if (!hasPassword) return null;
    if (form.currentPassword.length === 0) return null;
    return form.currentPassword.length >= 1;
  }, [form.currentPassword, hasPassword]);

  const canSubmit =
    newPasswordValid === true &&
    confirmValid === true &&
    (!hasPassword || form.currentPassword.length >= 1) &&
    submitState.status !== "saving";

  const handleChange = (key: keyof FormState) => (value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSubmitState((prev) =>
      prev.status === "success" ? { status: "idle" } : prev,
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitState({ status: "saving" });

    try {
      const result = await changePasswordOnServer({
        currentPassword: hasPassword ? form.currentPassword : undefined,
        newPassword: form.newPassword,
        confirmPassword: form.confirmPassword,
      });
      setSubmitState({
        status: "success",
        firstTime: !result.hadPassword,
      });
      setHasPassword(true);
      setForm(EMPTY_FORM);
      toast.success(
        i18n(result.hadPassword
          ? "Password changed successfully"
          : "Password set — you can now sign in with email"),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to change password.";
      setSubmitState({ status: "error", message });
      toast.error(i18n(message));
    }
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:rounded-3xl sm:p-6">
        <header className="mb-5 flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-background text-foreground">
            <KeyRound className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-foreground sm:text-lg">
              {hasPassword ? i18n("Change password") : i18n("Set a password")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {hasPassword
                ? i18n("Use a unique password you don't reuse anywhere else.")
                : i18n("Add a password so you can sign in with your email and password too.")}
            </p>
          </div>
        </header>

        {isGoogleOnly && !hasPassword && (
          <div className="mb-5 flex items-start gap-2 rounded-2xl border border-border bg-background p-3 text-sm text-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            {i18n("You normally sign in with Google. Setting a password gives you a fallback if you ever lose access to your Google account.")}</div>
        )}

        <form onSubmit={handleSubmit} className="grid gap-4">
          {hasPassword && (
            <FloatField
              icon={<Lock className="h-4 w-4" />}
              label={i18n("Current password")}
              type={show.current ? "text" : "password"}
              value={form.currentPassword}
              onChange={handleChange("currentPassword")}
              autoComplete="current-password"
              maxLength={FIELD_LIMITS.PASSWORD_MAX}
              valid={currentValid}
              trailing={
                <PasswordVisibilityButton
                  visible={show.current}
                  onClick={() =>
                    setShow((prev) => ({ ...prev, current: !prev.current }))
                  }
                />
              }
            />
          )}
          <FloatField
            icon={<Lock className="h-4 w-4" />}
            label={i18n("New password")}
            type={show.next ? "text" : "password"}
            value={form.newPassword}
            onChange={handleChange("newPassword")}
            autoComplete="new-password"
            maxLength={FIELD_LIMITS.PASSWORD_MAX}
            valid={newPasswordValid}
            trailing={
              <PasswordVisibilityButton
                visible={show.next}
                onClick={() =>
                  setShow((prev) => ({ ...prev, next: !prev.next }))
                }
              />
            }
          />
          <FloatField
            icon={<Lock className="h-4 w-4" />}
            label={i18n("Confirm new password")}
            type={show.confirm ? "text" : "password"}
            value={form.confirmPassword}
            onChange={handleChange("confirmPassword")}
            autoComplete="new-password"
            maxLength={FIELD_LIMITS.PASSWORD_MAX}
            valid={confirmValid}
            trailing={
              <PasswordVisibilityButton
                visible={show.confirm}
                onClick={() =>
                  setShow((prev) => ({ ...prev, confirm: !prev.confirm }))
                }
              />
            }
          />

          <PasswordChecklist password={form.newPassword} />

          {submitState.status === "error" && (
            <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {i18n(submitState.message)}
            </div>
          )}

          {submitState.status === "success" && (
            <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              {submitState.firstTime
                ? i18n("Password set. You can now sign in with your email and password.")
                : i18n("Password changed successfully.")}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!canSubmit}
              aria-busy={submitState.status === "saving"}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-xl disabled:cursor-not-allowed disabled:bg-muted disabled:hover:translate-y-0 sm:w-auto"
            >
              {submitState.status === "saving" ? (
                <ButtonLoader label={i18n("Saving...")} />
              ) : (
                <>
                  <KeyRound className="h-4 w-4" />
                  {hasPassword ? i18n("Update password") : i18n("Set password")}
                </>
              )}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:rounded-3xl sm:p-6">
        <header className="mb-3 flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-background text-foreground">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-foreground sm:text-lg">
              {i18n("Sign-in methods")}</h2>
            <p className="text-xs text-muted-foreground">
              {i18n("How you can access this account.")}</p>
          </div>
        </header>
        <ul className="grid gap-2 sm:grid-cols-2">
          <SignInMethod
            label={i18n("Google")}
            description={
              user.provider === "GOOGLE"
                ? i18n("Original sign-up method.")
                : i18n("Not connected.")
            }
            connected={user.provider === "GOOGLE"}
          />
          <SignInMethod
            label={i18n("Email + password")}
            description={
              hasPassword
                ? i18n("Active. Use the form above to rotate.")
                : i18n("Not set. Add one above.")
            }
            connected={hasPassword}
          />
        </ul>
      </section>
    </div>
  );
}

function PasswordChecklist({ password }: { password: string }) {
  const i18n = useInterfaceTranslations("InterfaceProfileComponentsSecurityTab");
  const checks = [
    {
      label: `At least ${FIELD_LIMITS.PASSWORD_MIN} characters`,
      ok: password.length >= FIELD_LIMITS.PASSWORD_MIN,
    },
    {
      label: i18n("Contains a lowercase letter"),
      ok: /[a-z]/.test(password),
    },
    {
      label: i18n("Contains an uppercase letter"),
      ok: /[A-Z]/.test(password),
    },
    {
      label: i18n("Contains a number"),
      ok: /\d/.test(password),
    },
  ];

  return (
    <ul className="grid gap-1.5 rounded-2xl border border-border bg-background p-3 text-xs">
      {checks.map((check) => (
        <li
          key={check.label}
          className={
            check.ok
              ? "flex items-center gap-2 font-semibold text-emerald-700"
              : "flex items-center gap-2 text-body"
          }
        >
          <span
            className={
              check.ok
                ? "grid h-4 w-4 place-items-center rounded-full bg-emerald-700 text-white"
                : "grid h-4 w-4 place-items-center rounded-full border border-border bg-card text-muted-foreground"
            }
          >
            {check.ok ? "✓" : "·"}
          </span>
          {i18n(check.label)}
        </li>
      ))}
    </ul>
  );
}

function SignInMethod({
  label,
  description,
  connected,
}: {
  label: string;
  description: string;
  connected: boolean;
}) {
  const i18n = useInterfaceTranslations("InterfaceProfileComponentsSecurityTab");
  return (
    <li
      className={
        connected
          ? "flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3"
          : "flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
      }
    >
      <span
        className={
          connected
            ? "grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-200 text-emerald-800"
            : "grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary text-muted-foreground"
        }
      >
        {connected ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <Lock className="h-4 w-4" />
        )}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-foreground">{i18n(label)}</p>
        <p className="text-[11px] text-muted-foreground">{i18n(description)}</p>
      </div>
    </li>
  );
}
