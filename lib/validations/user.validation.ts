import { z } from "zod";

import { FIELD_LIMITS, PHONE_REGEX } from "@/lib/auth/policy";
import { passwordSchema } from "@/lib/validations/auth.validation";

/**
 * Zod schemas for the User admin API and the customer self-serve
 * profile API (`/api/user/me`).
 *
 * Mirrors the Prisma `Role` enum so a schema rename here is a TS error.
 */

const ROLE = ["USER", "ADMIN"] as const;

/**
 * "Optional but trimmed string" — accepts an empty string from a
 * cleared form field and treats it the same as omission, so the
 * service layer can write `null` without the route having to special
 * case empty payloads.
 */
const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined));

/** Query string for `GET /api/admin/users`. */
export const adminUserQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(120).optional(),
  role: z.enum(ROLE).optional(),
});

/** Guest profiles have no authentication role or account-management actions. */
export const adminGuestQuerySchema = adminUserQuerySchema.omit({ role: true });

/** Body for `PATCH /api/admin/users/[id]/role`. */
export const updateUserRoleSchema = z.object({
  role: z.enum(ROLE),
});

/**
 * Body for `PATCH /api/user/me` — the self-serve profile editor.
 *
 * Every field is optional so the client can submit a partial patch
 * (e.g. just a new phone number). `name` is required *if present*
 * because we never want to blank out the display name.
 */
export const updateProfileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(FIELD_LIMITS.NAME_MIN, "Please enter your full name.")
      .max(FIELD_LIMITS.NAME_MAX, "Name is too long.")
      .optional(),
    phone: z
      .string()
      .trim()
      .min(FIELD_LIMITS.PHONE_MIN, "Please enter a valid phone number.")
      .max(FIELD_LIMITS.PHONE_MAX, "Phone number is too long.")
      .regex(PHONE_REGEX, "Please enter a valid phone number.")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    city: optionalTrimmed(FIELD_LIMITS.CITY_MAX),
    image: optionalTrimmed(2048),
  })
  .refine(
    (value) => Object.values(value).some((entry) => entry !== undefined),
    { message: "No changes to save." },
  );

/**
 * Body for `PATCH /api/user/me/password`.
 *
 * `currentPassword` is mandatory only for credential-based accounts,
 * but the route enforces that branch so the schema can stay simple.
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().max(FIELD_LIMITS.PASSWORD_MAX).optional(),
    newPassword: passwordSchema,
    confirmPassword: z.string().max(FIELD_LIMITS.PASSWORD_MAX),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export type AdminUserQueryInput = z.infer<typeof adminUserQuerySchema>;
export type AdminGuestQueryInput = z.infer<typeof adminGuestQuerySchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
