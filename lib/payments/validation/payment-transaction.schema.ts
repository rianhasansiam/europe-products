/**
 * Payment transaction query validation schemas.
 *
 * Moved from lib/validations/payment-transaction.validation.ts during
 * the payment module restructuring.
 */

import { z } from "zod";
import { PAYMENT_TRANSACTION_STATUSES } from "@/lib/payments/core/transaction-status";

export { PAYMENT_TRANSACTION_STATUSES };

function normalizeOptionalText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

function normalizeProvider(value: unknown): string | undefined {
  return normalizeOptionalText(value)?.toUpperCase();
}

const transactionHistoryBaseSchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.preprocess(
    normalizeOptionalText,
    z.enum(PAYMENT_TRANSACTION_STATUSES).optional(),
  ),
  provider: z.preprocess(
    normalizeProvider,
    z
      .string()
      .min(1)
      .max(40)
      .regex(
        /^[A-Z0-9_-]+$/,
        "Provider may contain only letters, numbers, underscores, and dashes.",
      )
      .optional(),
  ),
});

/** Query for the signed-in customer's own transaction ledger. */
export const customerTransactionQuerySchema =
  transactionHistoryBaseSchema;

/** Query for the complete, admin-only transaction ledger. */
export const adminTransactionQuerySchema =
  transactionHistoryBaseSchema.extend({
    search: z.preprocess(
      normalizeOptionalText,
      z.string().min(1).max(120).optional(),
    ),
    review: z.preprocess(
      normalizeOptionalText,
      z.enum(["OPEN", "RESOLVED"]).optional(),
    ),
  });

export type CustomerTransactionQueryInput = z.infer<
  typeof customerTransactionQuerySchema
>;
export type AdminTransactionQueryInput = z.infer<
  typeof adminTransactionQuerySchema
>;
