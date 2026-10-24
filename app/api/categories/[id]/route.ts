import type { NextRequest } from "next/server";
import { z } from "zod";

import { handleCategoryApiError } from "@/lib/api/category-error";
import { isAdminRequest, requireAdmin } from "@/lib/api/guards";
import { jsonError, ok } from "@/lib/api/response";
import { invalidateCategoryMutation } from "@/lib/cache/catalog-invalidation";
import { logAdminActivity } from "@/lib/services/admin-activity.service";
import {
  deleteCategory,
  getCategoryById,
  updateCategory,
} from "@/lib/services/category.service";
import { updateCategorySchema } from "@/lib/validations/category.validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  try {
    const isAdmin = await isAdminRequest();
    const category = await getCategoryById(
      id,
      isAdmin
        ? undefined
        : { effectiveActiveOnly: true, activeProductsOnly: true },
    );
    if (!category) return jsonError(404, "Category not found.");
    return ok(category);
  } catch (error) {
    return handleCategoryApiError("categories/[id].GET", error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { id } = await context.params;

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

  const parsed = updateCategorySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please review the highlighted fields and try again.", {
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    });
  }

  try {
    const previous = await getCategoryById(id);
    if (!previous) return jsonError(404, "Category not found.");
    const category = await updateCategory(id, parsed.data);
    await logAdminActivity({
      kind: "category",
      action: "Category updated",
      target: category.name,
      targetId: category.id,
      href: "/admin/categories",
      actor: guard.session.user,
    });
    invalidateCategoryMutation({
      reason: `category updated: ${category.id}`,
      categoryIds: [category.id],
      oldPaths: [previous.path],
      newPaths: [category.path],
    });
    return ok(category);
  } catch (error) {
    return handleCategoryApiError("categories/[id].PATCH", error);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { id } = await context.params;

  try {
    const category = await deleteCategory(id);
    await logAdminActivity({
      kind: "category",
      action: "Category deleted",
      target: category.name,
      targetId: category.id,
      href: "/admin/categories",
      actor: guard.session.user,
    });
    invalidateCategoryMutation({
      reason: `category deleted: ${category.id}`,
      categoryIds: [category.id],
      oldPaths: [category.path],
    });
    return ok(category);
  } catch (error) {
    return handleCategoryApiError("categories/[id].DELETE", error);
  }
}
