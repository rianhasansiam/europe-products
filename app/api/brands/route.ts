import type { NextRequest } from "next/server";
import { z } from "zod";

import { isAdminRequest, requireAdmin } from "@/lib/api/guards";
import { created, jsonError, ok } from "@/lib/api/response";
import { invalidateBrandMutation } from "@/lib/cache/catalog-invalidation";
import { logAdminActivity } from "@/lib/services/admin-activity.service";
import { createBrand, listBrands } from "@/lib/services/brand.service";
import { handleServiceError } from "@/lib/services/service-error";
import {
  brandQuerySchema,
  createBrandSchema,
} from "@/lib/validations/brand.validation";
import { apiLocale, localizeBrandSnapshots } from "@/lib/translations/public";

export const dynamic = "force-dynamic";

/** Public reads expose ACTIVE brands; admins can read every status. */
export async function GET(request: NextRequest) {
  const parsed = brandQuerySchema.safeParse(
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
    const { items, meta } = await listBrands(query);
    return ok(request.nextUrl.searchParams.has("locale")?await localizeBrandSnapshots(items,await apiLocale(request)):items, meta);
  } catch (error) {
    return handleServiceError("brands.GET", error);
  }
}

/** Admin-only creation. Slugs are generated once by the service. */
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

  const parsed = createBrandSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please review the highlighted fields and try again.", {
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    });
  }

  try {
    const brand = await createBrand(parsed.data);
    await logAdminActivity({
      kind: "product",
      action: "Brand created",
      target: brand.name,
      targetId: brand.id,
      href: "/admin/brands",
      actor: guard.session.user,
    });
    await invalidateBrandMutation({
      id: brand.id,
      slugs: [brand.slug],
      reason: `brand created: ${brand.id}`,
    });
    return created(brand);
  } catch (error) {
    return handleServiceError("brands.POST", error);
  }
}
