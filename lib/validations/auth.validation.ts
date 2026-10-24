import { z } from "zod";

import { FIELD_LIMITS, PHONE_REGEX } from "../auth/policy";

/**
 * Password rules. MUST stay aligned with `meetsPasswordPolicy` in
 * `policy.ts` — the client uses that helper to gate the UI, the server
 * uses this schema to gate the request.
 */
export const passwordSchema = z
  .string()
  .min(FIELD_LIMITS.PASSWORD_MIN, "Password must be at least 8 characters long.")
  .max(FIELD_LIMITS.PASSWORD_MAX, "Password is too long.")
  .regex(/[a-z]/, "Password must contain a lowercase letter.")
  .regex(/[A-Z]/, "Password must contain an uppercase letter.")
  .regex(/\d/, "Password must contain a number.");

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(FIELD_LIMITS.NAME_MIN, "Please enter your full name.")
      .max(FIELD_LIMITS.NAME_MAX, "Name is too long."),
    email: z
      .email("Please enter a valid email address.")
      .trim()
      .toLowerCase()
      .max(FIELD_LIMITS.EMAIL_MAX, "Email is too long."),
    password: passwordSchema,
    // confirmPassword only needs a sane upper bound; equality is checked below.
    confirmPassword: z.string().max(FIELD_LIMITS.PASSWORD_MAX),
    phone: z
      .string()
      .trim()
      .min(FIELD_LIMITS.PHONE_MIN, "Please enter a valid phone number.")
      .max(FIELD_LIMITS.PHONE_MAX, "Phone number is too long.")
      .regex(PHONE_REGEX, "Please enter a valid phone number."),
    city: z
      .string()
      .trim()
      .min(FIELD_LIMITS.CITY_MIN, "Please enter your city.")
      .max(FIELD_LIMITS.CITY_MAX, "City is too long."),
    agreeToTerms: z.literal(true, {
      error: "You must accept the Terms & Privacy Policy.",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export const loginSchema = z.object({
  email: z
    .email("Please enter a valid email address.")
    .trim()
    .toLowerCase()
    .max(FIELD_LIMITS.EMAIL_MAX),
  // For login, only sanity caps. The actual policy was enforced at signup.
  password: z.string().min(1).max(FIELD_LIMITS.PASSWORD_MAX),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
