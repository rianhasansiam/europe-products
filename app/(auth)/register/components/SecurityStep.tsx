"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { Lock } from "lucide-react";

import { FIELD_LIMITS } from "@/lib/auth/policy";

import FloatField from "@/app/(auth)/_components/FloatField";
import PasswordVisibilityButton from "@/app/(auth)/_components/PasswordVisibilityButton";

import PasswordStrengthMeter from "./PasswordStrengthMeter";
import type {
  FieldUpdater,
  PasswordField,
  PasswordScore,
  RegisterForm,
} from "../page";

type SecurityStepProps = {
  form: RegisterForm;
  passwordScore: PasswordScore;
  passwordLabel: string;
  passwordColorClass: string;
  visiblePasswordField: PasswordField | null;
  onFieldChange: FieldUpdater;
  onTogglePassword: (field: PasswordField | null) => void;
};

export default function SecurityStep({
  form,
  passwordScore,
  passwordLabel,
  passwordColorClass,
  visiblePasswordField,
  onFieldChange,
  onTogglePassword,
}: SecurityStepProps) {
  const i18n = useInterfaceTranslations("InterfaceRegisterComponentsSecurityStep");
  const showPassword = visiblePasswordField === "password";
  const showConfirmPassword = visiblePasswordField === "confirmPassword";

  return (
    <>
      <FloatField
        icon={<Lock className="h-4 w-4" />}
        label={i18n("Password")}
        value={form.password}
        onChange={(value) => onFieldChange("password", value)}
        type={showPassword ? "text" : "password"}
        autoComplete="new-password"
        maxLength={FIELD_LIMITS.PASSWORD_MAX}
        trailing={
          <PasswordVisibilityButton
            visible={showPassword}
            onClick={() => onTogglePassword(showPassword ? null : "password")}
          />
        }
      />

      <PasswordStrengthMeter
        password={form.password}
        score={passwordScore}
        label={passwordLabel}
        colorClass={passwordColorClass}
      />

      <FloatField
        icon={<Lock className="h-4 w-4" />}
        label={i18n("Confirm password")}
        value={form.confirmPassword}
        onChange={(value) => onFieldChange("confirmPassword", value)}
        type={showConfirmPassword ? "text" : "password"}
        autoComplete="new-password"
        maxLength={FIELD_LIMITS.PASSWORD_MAX}
        valid={
          form.confirmPassword.length === 0
            ? null
            : form.password === form.confirmPassword
        }
        trailing={
          <PasswordVisibilityButton
            visible={showConfirmPassword}
            onClick={() =>
              onTogglePassword(showConfirmPassword ? null : "confirmPassword")
            }
          />
        }
      />
    </>
  );
}
