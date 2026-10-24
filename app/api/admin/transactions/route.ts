import type { z } from "zod";

import { adminRoute } from "@/lib/api/handlers";
import { listTransactionsForAdmin } from "@/lib/payments";
import { adminTransactionQuerySchema } from "@/lib/payments/validation/payment-transaction.schema";

type AdminTransactionQuery = z.infer<typeof adminTransactionQuerySchema>;

/**
 * GET /api/admin/transactions
 *
 * Admin-only, paginated ledger across every payment transaction. The shared
 * admin route guard refreshes the caller's role from the database.
 */
export const GET = adminRoute({
  scope: "admin.transactions.GET",
  querySchema: adminTransactionQuerySchema,
  handler: async ({ query }) => {
    const { items, meta } = await listTransactionsForAdmin(
      query as AdminTransactionQuery,
    );
    return { data: items, meta };
  },
});
