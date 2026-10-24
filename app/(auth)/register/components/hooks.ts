"use client";

import { useMemo } from "react";

import {
  EMAIL_REGEX,
  FIELD_LIMITS,
  PHONE_REGEX,
  meetsPasswordPolicy,
} from "@/lib/auth/policy";

import { PASSWORD_COLOR_CLASSES, PASSWORD_LABELS } from "./constants";
import type { PasswordScore, RegisterForm, RegisterStep } from "../page";

/**
 * Score a password from 0..4 based on length + character classes.
 * Used purely as a UX hint for the strength meter — the server's policy
 * (in `lib/auth/policy.ts`) is the authoritative gate.
 */
export function getPasswordScore(password: string): PasswordScore {
  if (!password) return 0;

  let score = 0;

  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  return Math.min(score, 4) as PasswordScore;
}

/**
 * Mirrors the backend Zod rules in `lib/validations/auth.validation.ts`.
 * If the server tightens its rules, update `lib/auth/policy.ts` and both
 * sides stay in sync.
 */
export function useRegisterValidation(
  form: RegisterForm,
  currentStep: RegisterStep,
) {
  const emailValid = useMemo(
    () =>
      EMAIL_REGEX.test(form.email) &&
      form.email.length <= FIELD_LIMITS.EMAIL_MAX,
    [form.email],
  );

  const passwordScore = useMemo(
    () => getPasswordScore(form.password),
    [form.password],
  );

  const passwordValid = meetsPasswordPolicy(form.password);

  const accountStepValid =
    form.name.trim().length >= FIELD_LIMITS.NAME_MIN &&
    form.name.trim().length <= FIELD_LIMITS.NAME_MAX &&
    emailValid;

  const securityStepValid =
    passwordValid && form.password === form.confirmPassword;

  const phoneTrimmed = form.phone.trim();
  const cityTrimmed = form.city.trim();

  const profileStepValid =
    phoneTrimmed.length >= FIELD_LIMITS.PHONE_MIN &&
    phoneTrimmed.length <= FIELD_LIMITS.PHONE_MAX &&
    PHONE_REGEX.test(phoneTrimmed) &&
    cityTrimmed.length >= FIELD_LIMITS.CITY_MIN &&
    cityTrimmed.length <= FIELD_LIMITS.CITY_MAX &&
    form.agreeToTerms;

  const canContinue =
    currentStep === 0
      ? accountStepValid
      : currentStep === 1
        ? securityStepValid
        : profileStepValid;

  return {
    emailValid,
    passwordScore,
    passwordLabel: PASSWORD_LABELS[passwordScore],
    passwordColorClass: PASSWORD_COLOR_CLASSES[passwordScore],
    canContinue,
  };
}
