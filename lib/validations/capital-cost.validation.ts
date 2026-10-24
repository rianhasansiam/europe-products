import { z } from "zod";

/**
 * Zod schemas for the Admin Capital & Cost Tracker.
 *
 * Kept HTTP-free so the same shapes can power route handlers, admin
 * forms, or scripts. Mirrors the Prisma `AdminCapital` and
 * `AdminOtherCost` models. This feature is ADMIN-ONLY and fully
 * isolated from order/revenue/product logic — it only ever reads
 * product data to derive an informational "product cost" figure.
 */

/** Money columns are Decimal(12, 2) → max 9 999 999 999.99. */
const money = z
  .number({ message: "Amount must be a number." })
  .positive("Amount must be greater than zero.")
  .max(9_999_999_999.99, "Amount is too large.");

const reason = z
  .string()
  .trim()
  .min(2, "Reason is too short.")
  .max(160, "Reason is too long.");

const description = z
  .string()
  .trim()
  .max(2000, "Description is too long.")
  .optional()
  .nullable();

const note = z
  .string()
  .trim()
  .max(500, "Note is too long.")
  .optional()
  .nullable();

/** Body for `POST /api/admin/capital-costs/capital` (adds a contribution). */
export const addCapitalSchema = z.object({
  amount: money,
  note,
});

/** Body for POST /api/admin/capital-costs/product-costs. */
export const addProductCostsSchema = z.object({
  productIds: z
    .array(z.string().trim().min(1))
    .min(1, "Select at least one product.")
    .max(100, "You can add at most 100 products at once.")
    .transform((ids) => Array.from(new Set(ids))),
});

/** Body for `POST /api/admin/capital-costs/other-costs`. */
export const createOtherCostSchema = z.object({
  amount: money,
  reason,
  description,
  // Accept an ISO string (or anything `Date`-coercible) and normalise to a
  // real Date for Prisma.
  costDate: z.coerce.date({ message: "A valid cost date is required." }),
});

/**
 * Body for `PATCH /api/admin/capital-costs/other-costs/[id]`.
 *
 * Every field optional, but at least one must be provided so a PATCH can
 * never be a silent no-op.
 */
export const updateOtherCostSchema = z
  .object({
    amount: money.optional(),
    reason: reason.optional(),
    description,
    costDate: z.coerce.date().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update.",
  });

/**
 * Query string for `GET /api/admin/capital-costs/other-costs`.
 *
 * `z.coerce.*` because URLSearchParams values are strings. Defaults keep
 * callers minimal.
 */
export const otherCostQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(100),
  search: z.string().trim().min(1).max(160).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  minAmount: z.coerce.number().min(0).optional(),
  maxAmount: z.coerce.number().min(0).optional(),
});

export type AddCapitalInput = z.infer<typeof addCapitalSchema>;
export type AddProductCostsInput = z.infer<typeof addProductCostsSchema>;
export type CreateOtherCostInput = z.infer<typeof createOtherCostSchema>;
export type UpdateOtherCostInput = z.infer<typeof updateOtherCostSchema>;
export type OtherCostQueryInput = z.infer<typeof otherCostQuerySchema>;
