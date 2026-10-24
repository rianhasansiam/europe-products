import type { NextRequest } from "next/server";
import { z } from "zod";

import { isAdminRequest, requireAdmin } from "@/lib/api/guards";
import { jsonError, ok } from "@/lib/api/response";
import { invalidateManufacturerMutation } from "@/lib/cache/catalog-invalidation";
import { logAdminActivity } from "@/lib/services/admin-activity.service";
import {
  deleteManufacturer,
  getManufacturerById,
  updateManufacturer,
} from "@/lib/services/manufacturer.service";
import { handleServiceError } from "@/lib/services/service-error";
import { updateManufacturerSchema } from "@/lib/validations/manufacturer.validation";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  try {
    const manufacturer = await getManufacturerById(id);
    if (!manufacturer) return jsonError(404, "Manufacturer not found.");
    const isAdmin = await isAdminRequest();
    if (!isAdmin && manufacturer.status !== "ACTIVE") {
      return jsonError(404, "Manufacturer not found.");
    }
    return ok(manufacturer);
  } catch (error) {
    return handleServiceError("manufacturers/[id].GET", error);
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

  const parsed = updateManufacturerSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please review the highlighted fields and try again.", {
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    });
  }

  const { id } = await context.params;
  try {
    const manufacturer = await updateManufacturer(id, parsed.data);
    await logAdminActivity({
      kind: "product",
      action: "Manufacturer updated",
      target: manufacturer.name,
      targetId: manufacturer.id,
      href: "/admin/manufacturers",
      actor: guard.session.user,
    });
    await invalidateManufacturerMutation({
      id: manufacturer.id,
      reason: `manufacturer updated: ${manufacturer.id}`,
    });
    return ok(manufacturer);
  } catch (error) {
    return handleServiceError("manufacturers/[id].PATCH", error);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  try {
    const existing = await getManufacturerById(id);
    if (!existing) return jsonError(404, "Manufacturer not found.");

    const result = await deleteManufacturer(id);
    await logAdminActivity({
      kind: "product",
      action: "Manufacturer deleted",
      target: existing.name,
      targetId: existing.id,
      href: "/admin/manufacturers",
      actor: guard.session.user,
    });
    await invalidateManufacturerMutation({
      id: existing.id,
      reason: `manufacturer deleted: ${existing.id}`,
    });
    return ok(result);
  } catch (error) {
    return handleServiceError("manufacturers/[id].DELETE", error);
  }
}
