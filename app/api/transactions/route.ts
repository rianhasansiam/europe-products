import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api/guards";
import { jsonError, ok } from "@/lib/api/response";
import { listTransactionsForUser } from "@/lib/payments";
import { customerTransactionQuerySchema } from "@/lib/payments/validation/payment-transaction.schema";
import { handleServiceError } from "@/lib/services/service-error";

/**
 * GET /api/transactions
 *
 * Returns only payment transactions whose order belongs to the signed-in
 * account. Provider secrets, raw responses, validation IDs, gateway URLs,
 * and idempotency keys are intentionally absent from the response shape.
 */
export async function GET(request: NextRequest) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const parsed = customerTransactionQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success) {
    return jsonError(400, "Invalid query parameters.", {
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    });
  }

  try {
    const { items, meta } = await listTransactionsForUser(
      guard.session.user.id,
      parsed.data,
    );
    return ok(items, meta);
  } catch (error) {
    return handleServiceError("transactions.GET", error);
  }
}
