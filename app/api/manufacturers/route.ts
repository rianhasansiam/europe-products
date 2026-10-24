import type { NextRequest } from "next/server";
import { z } from "zod";

import { isAdminRequest, requireAdmin } from "@/lib/api/guards";
import { created, jsonError, ok } from "@/lib/api/response";
import { invalidateManufacturerMutation } from "@/lib/cache/catalog-invalidation";
import { logAdminActivity } from "@/lib/services/admin-activity.service";
import {
  createManufacturer,
  listManufacturers,
} from "@/lib/services/manufacturer.service";
import { handleServiceError } from "@/lib/services/service-error";
import {
  createManufacturerSchema,
  manufacturerQuerySchema,
} from "@/lib/validations/manufacturer.validation";

export const dynamic = "force-dynamic";

/** Public reads expose ACTIVE manufacturers; admins can read every status. */
export async function GET(request: NextRequest) {
  const parsed = manufacturerQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success) {
    return jsonError(400, "Invalid query parameters.", {
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    });
  }

  try {
    const isAdmin = await isAdminRequest();
    const query = isAdmin
      ? parsed.data
      : { ...parsed.data, status: "ACTIVE" as const };
    const { items, meta } = await listManufacturers(query);
    return ok(items, meta);
  } catch (error) {
    return handleServiceError("manufacturers.GET", error);
  }
}

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

  const parsed = createManufacturerSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please review the highlighted fields and try again.", {
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    });
  }

  try {
    const manufacturer = await createManufacturer(parsed.data);
    await logAdminActivity({
      kind: "product",
      action: "Manufacturer created",
      target: manufacturer.name,
      targetId: manufacturer.id,
      href: "/admin/manufacturers",
      actor: guard.session.user,
    });
    await invalidateManufacturerMutation({
      id: manufacturer.id,
      reason: `manufacturer created: ${manufacturer.id}`,
    });
    return created(manufacturer);
  } catch (error) {
    return handleServiceError("manufacturers.POST", error);
  }
}
