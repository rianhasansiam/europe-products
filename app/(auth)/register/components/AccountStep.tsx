"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { Mail, User } from "lucide-react";

import { FIELD_LIMITS } from "@/lib/auth/policy";

import FloatField from "@/app/(auth)/_components/FloatField";
import {
  GoogleSignInButton,
  SocialDivider,
} from "@/app/(auth)/_components/GoogleSignInButton";
import type { FieldUpdater, RegisterForm } from "../page";

type AccountStepProps = {
  form: RegisterForm;
  emailValid: boolean;
  onFieldChange: FieldUpdater;
};

export default function AccountStep({
  form,
  emailValid,
  onFieldChange,
}: AccountStepProps) {
  const i18n = useInterfaceTranslations("InterfaceRegisterComponentsAccountStep");
  return (
    <>
      <FloatField
        icon={<User className="h-4 w-4" />}
        label={i18n("Full name")}
        value={form.name}
        onChange={(value) => onFieldChange("name", value)}
        autoComplete="name"
        maxLength={FIELD_LIMITS.NAME_MAX}
      />

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

      <SocialDivider />
      <GoogleSignInButton />
    </>
  );
}
