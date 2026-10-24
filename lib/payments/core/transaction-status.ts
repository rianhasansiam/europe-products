import { PaymentTransactionStatus } from "@/app/generated/prisma/enums";

// The generated enum module is safe to share with client components.
export const PAYMENT_TRANSACTION_STATUSES = Object.values(
  PaymentTransactionStatus,
);

export type { PaymentTransactionStatus } from "@/app/generated/prisma/enums";
