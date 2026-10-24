import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api/guards";
import { jsonError, ok } from "@/lib/api/response";
import { listMyOrders } from "@/lib/services/order.service";
import { handleServiceError } from "@/lib/services/service-error";
import { orderQuerySchema } from "@/lib/validations/order.validation";

/**
 * GET /api/orders/my-orders
 *
 * Logged-in users only. Returns the caller's orders with pagination
 * and optional status filter, newest first.
 */
export async function GET(request: NextRequest) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = orderQuerySchema.safeParse(params);
  if (!parsed.success) {
    return jsonError(400, "Invalid query parameters.", {
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    });
  }

  try {
    const { items, meta } = await listMyOrders(
      guard.session.user.id,
      parsed.data,
    );
    return ok(items, meta);
  } catch (error) {
    return handleServiceError("orders.my-orders.GET", error);
  }
}
