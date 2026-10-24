import type { NextRequest } from "next/server";
import { z } from "zod";

import { handleCategoryApiError } from "@/lib/api/category-error";
import { requireAdmin } from "@/lib/api/guards";
import { jsonError, ok } from "@/lib/api/response";
import { invalidateCategoryMutation } from "@/lib/cache/catalog-invalidation";
import { logAdminActivity } from "@/lib/services/admin-activity.service";
import { reorderCategories } from "@/lib/services/category.service";
import { reorderCategoriesSchema } from "@/lib/validations/category.validation";

export async function PATCH(request: NextRequest) {
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

  const parsed = reorderCategoriesSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please review the highlighted fields and try again.", {
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    });
  }

  try {
    const categories = await reorderCategories(parsed.data);
    await logAdminActivity({
      kind: "category",
      action: "Categories reordered",
      target: parsed.data.parentId ? "Subcategories" : "Root categories",
      targetId: parsed.data.parentId,
      href: "/admin/categories",
      actor: guard.session.user,
    });
    invalidateCategoryMutation({
      reason: `categories reordered under ${parsed.data.parentId ?? "root"}`,
      categoryIds: parsed.data.orderedIds,
    });
    return ok(categories);
  } catch (error) {
    return handleCategoryApiError("categories/reorder.PATCH", error);
  }
}
