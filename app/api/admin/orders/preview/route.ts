import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/api/guards";
import { jsonError, ok } from "@/lib/api/response";
import { previewCheckout } from "@/lib/services/checkout.service";
import { handleServiceError } from "@/lib/services/service-error";
import { adminCheckoutPreviewSchema } from "@/lib/validations/checkout.validation";

/**
 * POST /api/admin/orders/preview
 *
 * Returns a server-calculated quote for the admin order form. This is kept
 * separate from the customer preview endpoint because it supports both a
 * selected account customer and a walk-in / guest customer.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return jsonError(415, "Content-Type must be application/json.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON payload.");
  }

  const parsed = adminCheckoutPreviewSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please review the highlighted fields and try again.", {
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    });
  }

  try {
    const quote = await previewCheckout(null, {
      items: parsed.data.items,
      deliveryZone: parsed.data.deliveryZone,
      promoCode: parsed.data.promoCode,
    });
    return ok(quote);
  } catch (error) {
    return handleServiceError("admin.orders.preview.POST", error);
  }
}
