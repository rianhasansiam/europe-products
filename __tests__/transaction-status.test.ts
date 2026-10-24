import { describe, expect, it } from "vitest";

import { PaymentTransactionStatus } from "@/app/generated/prisma/enums";
import {
  getTransactionStatusMeta,
  TRANSACTION_STATUS_META,
  TRANSACTION_STATUS_VALUES,
} from "@/features/transactions/api";
import { PAYMENT_TRANSACTION_STATUSES } from "@/lib/payments/core/transaction-status";
import {
  adminTransactionQuerySchema,
  customerTransactionQuerySchema,
} from "@/lib/payments/validation/payment-transaction.schema";

const databaseStatuses = Object.values(PaymentTransactionStatus);

describe("payment transaction status contract", () => {
  it("keeps the UI filters and query validators aligned with the database enum", () => {
    expect(PAYMENT_TRANSACTION_STATUSES).toEqual(databaseStatuses);
    expect(TRANSACTION_STATUS_VALUES).toEqual(databaseStatuses);
    expect(Object.keys(TRANSACTION_STATUS_META).sort()).toEqual(
      [...databaseStatuses].sort(),
    );
  });

  it.each(databaseStatuses)("displays and accepts filters for %s", (status) => {
    const metadata = getTransactionStatusMeta(status);

    expect(metadata).toBe(TRANSACTION_STATUS_META[status]);
    expect(metadata.label).toEqual(expect.any(String));
    expect(metadata.label).not.toBe("Unknown");
    expect(metadata.pill).toMatch(/\bbg-\S+/);
    expect(metadata.pill).toMatch(/\btext-\S+/);
    for (const schema of [adminTransactionQuerySchema, customerTransactionQuerySchema]) {
      expect(schema.parse({ status }).status).toBe(status);
    }
  });

  it.each(["FUTURE_PROVIDER_STATE", "__proto__", "constructor", "toString"])(
    "rejects an unknown status filter %s",
    (status) => {
      expect(adminTransactionQuerySchema.safeParse({ status }).success).toBe(false);
      expect(customerTransactionQuerySchema.safeParse({ status }).success).toBe(false);
    },
  );

  it.each([
    "FUTURE_PROVIDER_STATE",
    "__proto__",
    "constructor",
    "toString",
    null,
    undefined,
  ])("uses a neutral fallback for an unrecognized value %j", (status) => {
    expect(getTransactionStatusMeta(status)).toEqual({
      label: "Unknown",
      pill: "bg-gray-100 text-gray-700 ring-gray-200",
    });
  });
});
