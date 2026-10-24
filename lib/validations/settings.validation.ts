import { z } from "zod";
import { BASE_CURRENCY } from "@/lib/currency/config";

/**
 * Zod schemas for store settings + promo codes.
 *
 * Store settings is a singleton: the admin sees one record and only
 * ever PATCHes it. Promo codes are a normal CRUD list. Both are
 * managed from the admin "Settings" page.
 */

const DISCOUNT_TYPE = ["FLAT", "PERCENT"] as const;
const PROMO_STATUS = ["ACTIVE", "INACTIVE"] as const;

/* -------------------------------------------------------------------------- */
/*  Store settings                                                            */
/* -------------------------------------------------------------------------- */

export const updateStoreSettingsSchema = z
  .object({
    taxRate: z
      .coerce
      .number()
      .min(0, "Tax rate cannot be negative.")
      .max(1, "Tax rate is a fraction (0..1). Use 0.05 for 5%.")
      .optional(),
    standardShippingFee: z
      .coerce
      .number()
      .min(0)
      .max(1_000_000)
      .optional(),
    expressShippingFee: z
      .coerce
      .number()
      .min(0)
      .max(1_000_000)
      .optional(),
    freeShippingThreshold: z
      .coerce
      .number()
      .min(0)
      .max(10_000_000)
      .optional(),
    // New prices use USD; legacy conversion requires an explicit migration.
    currency: z.literal(BASE_CURRENCY).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update.",
  });

/* -------------------------------------------------------------------------- */
/*  Promo codes                                                               */
/* -------------------------------------------------------------------------- */

const code = z
  .string()
  .trim()
  .min(2, "Promo code is too short.")
  .max(40, "Promo code is too long.")
  .regex(/^[A-Z0-9_-]+$/i, "Use only letters, numbers, '-' or '_'.");

const description = z
  .string()
  .trim()
  .max(280)
  .optional()
  .nullable();

const value = z
  .coerce
  .number()
  .min(0, "Discount value cannot be negative.");

const minOrder = z
  .coerce
  .number()
  .min(0)
  .max(100_000_000)
  .optional()
  .nullable();

const maxDiscount = z
  .coerce
  .number()
  .min(0)
  .max(100_000_000)
  .optional()
  .nullable();

const dateField = z
  .string()
  .trim()
  .max(40)
  .optional()
  .nullable()
  .refine(
    (value) => {
      if (value === undefined || value === null || value === "") return true;
      return !Number.isNaN(new Date(value).getTime());
    },
    { message: "Invalid date." },
  );

const usageLimit = z
  .coerce
  .number()
  .int()
  .min(0)
  .max(1_000_000)
  .optional()
  .nullable();

/**
 * Shared business rules: PERCENT discounts must be 0..100, and the
 * date range (when provided) must be ordered.
 */
function refineDiscountRules<T extends z.ZodTypeAny>(schema: T) {
  return schema
    .refine(
      (data) => {
        const value = data as {
          discountType?: "FLAT" | "PERCENT";
          value?: number;
        };
        if (value.discountType !== "PERCENT") return true;
        if (value.value === undefined) return true;
        return value.value >= 0 && value.value <= 100;
      },
      {
        message: "Percent discount must be between 0 and 100.",
        path: ["value"],
      },
    )
    .refine(
      (data) => {
        const range = data as { startsAt?: string | null; endsAt?: string | null };
        if (!range.startsAt || !range.endsAt) return true;
        const start = new Date(range.startsAt);
        const end = new Date(range.endsAt);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
          return true;
        }
        return start.getTime() <= end.getTime();
      },
      { message: "End date must be after the start date.", path: ["endsAt"] },
    );
}

const baseCreate = z.object({
  code,
  description,
  discountType: z.enum(DISCOUNT_TYPE).default("FLAT"),
  value,
  minOrder,
  maxDiscount,
  startsAt: dateField,
  endsAt: dateField,
  usageLimit,
  status: z.enum(PROMO_STATUS).default("ACTIVE"),
});

export const createPromoCodeSchema = refineDiscountRules(baseCreate);

const baseUpdate = z
  .object({
    code: code.optional(),
    description,
    discountType: z.enum(DISCOUNT_TYPE).optional(),
    value: value.optional(),
    minOrder,
    maxDiscount,
    startsAt: dateField,
    endsAt: dateField,
    usageLimit,
    status: z.enum(PROMO_STATUS).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update.",
  });

export const updatePromoCodeSchema = refineDiscountRules(baseUpdate);

export type UpdateStoreSettingsInput = z.infer<typeof updateStoreSettingsSchema>;
export type CreatePromoCodeInput = z.infer<typeof createPromoCodeSchema>;
export type UpdatePromoCodeInput = z.infer<typeof updatePromoCodeSchema>;
