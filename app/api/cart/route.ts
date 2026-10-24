import type { NextRequest } from "next/server";
import { z } from "zod";

import { getRequestCurrencyContext } from "@/lib/currency/request-currency";

import { requireUser } from "@/lib/api/guards";
import { hasUserOrAdminAccess } from "@/lib/auth/access";
import { created, jsonError, ok } from "@/lib/api/response";
import {
  addToCart,
  getMyCart,
  syncCartItems,
} from "@/lib/services/cart.service";
import { handleServiceError } from "@/lib/services/service-error";
import {
  addToCartSchema,
  syncCartSchema,
} from "@/lib/validations/cart.validation";

/**
 * GET /api/cart
 *
 * Logged-in users only. Returns the caller's cart lines plus a
 * server-computed summary (totals come from DB prices, never the client).
 */
export async function GET() {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;
  if (!hasUserOrAdminAccess(guard.session.user.role)) {
    return jsonError(403, "Cart API is only available for USER/ADMIN.");
  }

  try {
    const { items, summary } = await getMyCart(guard.session.user.id);
    return ok({ items, summary });
  } catch (error) {
    return handleServiceError("cart.GET", error);
  }
}

/**
 * POST /api/cart
 *
 * Logged-in users only. Adds a product (or increments quantity if the
 * user already has a row for it). Stock and status are checked in the
 * service; quantity is capped at `Product.stock`.
 */
export async function POST(request: NextRequest) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;
  if (!hasUserOrAdminAccess(guard.session.user.role)) {
    return jsonError(403, "Cart API is only available for USER/ADMIN.");
  }

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

  const parsed = addToCartSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please review the highlighted fields and try again.", {
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    });
  }

  try {
    const item = await addToCart(guard.session.user.id, parsed.data);
    const response = created(item);
    const { pricingReady } = await getRequestCurrencyContext();
    response.headers.set("X-Store-Pricing-Ready", pricingReady === true ? "true" : "false");
    return response;
  } catch (error) {
    return handleServiceError("cart.POST", error);
  }
}

/**
 * PUT /api/cart
 *
 * Logged-in USER/ADMIN only. Sync local cart payload into DB and
 * return the latest server cart snapshot.
 */
export async function PUT(request: NextRequest) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;
  if (!hasUserOrAdminAccess(guard.session.user.role)) {
    return jsonError(403, "Cart API is only available for USER/ADMIN.");
  }

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

  const parsed = syncCartSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please review the highlighted fields and try again.", {
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    });
  }

  try {
    const result = await syncCartItems(guard.session.user.id, parsed.data);
    return ok(result);
  } catch (error) {
    return handleServiceError("cart.PUT", error);
  }
}
