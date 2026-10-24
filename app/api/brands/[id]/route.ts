import type { NextRequest } from "next/server";
import { z } from "zod";

import { isAdminRequest, requireAdmin } from "@/lib/api/guards";
import { jsonError, ok } from "@/lib/api/response";
import { invalidateBrandMutation } from "@/lib/cache/catalog-invalidation";
import { logAdminActivity } from "@/lib/services/admin-activity.service";
import {
  deleteBrand,
  getBrandById,
  updateBrand,
} from "@/lib/services/brand.service";
import { handleServiceError } from "@/lib/services/service-error";
import { updateBrandSchema } from "@/lib/validations/brand.validation";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  try {
    const brand = await getBrandById(id);
    if (!brand) return jsonError(404, "Brand not found.");
    const isAdmin = await isAdminRequest();
    if (!isAdmin && brand.status !== "ACTIVE") {
      return jsonError(404, "Brand not found.");
    }
    return ok(brand);
  } catch (error) {
    return handleServiceError("brands/[id].GET", error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
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

  const parsed = updateBrandSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please review the highlighted fields and try again.", {
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    });
  }

  const { id } = await context.params;
  try {
    const previous = await getBrandById(id);
    if (!previous) return jsonError(404, "Brand not found.");
    const brand = await updateBrand(id, parsed.data);
    await logAdminActivity({
      kind: "product",
      action: "Brand updated",
      target: brand.name,
      targetId: brand.id,
      href: "/admin/brands",
      actor: guard.session.user,
    });
    await invalidateBrandMutation({
      id: brand.id,
      slugs: [previous.slug, brand.slug],
      reason: `brand updated: ${brand.id}`,
    });
    return ok(brand);
  } catch (error) {
    return handleServiceError("brands/[id].PATCH", error);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  try {
    const existing = await getBrandById(id);
    if (!existing) return jsonError(404, "Brand not found.");

    const result = await deleteBrand(id);
    await logAdminActivity({
      kind: "product",
      action: "Brand deleted",
      target: existing.name,
      targetId: existing.id,
      href: "/admin/brands",
      actor: guard.session.user,
    });
    await invalidateBrandMutation({
      id: existing.id,
      slugs: [existing.slug],
      reason: `brand deleted: ${existing.id}`,
    });
    return ok(result);
  } catch (error) {
    return handleServiceError("brands/[id].DELETE", error);
  }
}
