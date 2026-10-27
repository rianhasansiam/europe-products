import type { NextRequest } from "next/server";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import { z } from "zod";

import { isAdminRequest, requireAdmin } from "@/lib/api/guards";
import { jsonError, ok } from "@/lib/api/response";
import {
  invalidateProductSnapshots,
  productInvalidationSnapshot,
} from "@/lib/cache/catalog-invalidation";
import { logAdminActivity } from "@/lib/services/admin-activity.service";
import {
  getProductById,
  getActiveProductById,
  hardDeleteProduct,
  ProductError,
  serializeProduct,
  updateProduct,
} from "@/lib/services/product.service";
import { updateProductSchema } from "@/lib/validations/product.validation";
import { apiLocale, localizeProductSnapshots } from "@/lib/translations/public";

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/products/[id] — public, returns product + category. */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  try {
    const isAdmin = await isAdminRequest();
    const product = isAdmin
      ? await getProductById(id)
      : await getActiveProductById(id);
    if (!product) return jsonError(404, "Product not found.");
    const serialized=serializeProduct(product);
    return ok(_request.nextUrl.searchParams.has("locale")?(await localizeProductSnapshots([serialized],await apiLocale(_request)))[0]:serialized);
  } catch (error) {
    console.error("[products/[id].GET] failed", error);
    return jsonError(500, "Failed to fetch product.");
  }
}

/** PATCH /api/products/[id] — admin only, partial update. */
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

  const parsed = updateProductSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    const messages = Object.values(fieldErrors)
      .flat()
      .filter((msg): msg is string => typeof msg === "string" && Boolean(msg.trim()));
    const errorMessage =
      messages.length > 0
        ? messages.join(". ")
        : "Missing or invalid required fields.";
    return jsonError(400, errorMessage, {
      fieldErrors,
    });
  }

  const existing = await getProductById(id);
  if (!existing) return jsonError(404, "Product not found.");

  const existingSale = existing.salePrice.toNumber();
  const existingDiscount =
    existing.discountPrice != null ? existing.discountPrice.toNumber() : null;

  const nextSale = parsed.data.salePrice ?? existingSale;
  const nextDiscount =
    parsed.data.discountPrice !== undefined
      ? parsed.data.discountPrice
      : existingDiscount;
  if (nextDiscount != null && nextDiscount > nextSale) {
    return jsonError(400, "Discount price cannot exceed the sale price.", {
      fieldErrors: { discountPrice: ["Discount price exceeds sale price."] },
    });
  }

  try {
    const previousSnapshot = productInvalidationSnapshot(existing);
    const product = await updateProduct(id, parsed.data);
    await logAdminActivity({
      kind: "product",
      action: "updated",
      target: product.name,
      targetId: product.id,
      href: "/admin/products",
      actor: guard.session.user,
    });
    invalidateProductSnapshots(
      [previousSnapshot, productInvalidationSnapshot(product)],
      {
        reason: `product updated: ${product.id}`,
        sitemap: true,
        categoryTree:
          parsed.data.status !== undefined ||
          parsed.data.categoryId !== undefined,
      },
    );
    return ok(serializeProduct(product));
  } catch (error) {
    if (error instanceof ProductError) {
      return jsonError(error.status, error.message, error.details);
    }
    if (
      error instanceof PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return jsonError(404, "Product not found.");
    }
    if (
      error instanceof PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const target = (error.meta?.target as string[] | undefined) ?? [];
      if (target.includes("sku")) {
        return jsonError(409, "A variant SKU must be unique.", {
          fieldErrors: { variants: ["Duplicate SKU."] },
        });
      }
      return jsonError(409, "Each option combination must be unique.", {
        fieldErrors: { variants: ["Duplicate option combination."] },
      });
    }
    console.error("[products/[id].PATCH] failed", error);
    return jsonError(500, "Failed to update product.");
  }
}

/**
 * DELETE /api/products/[id]
 *
 * Admin only. Hard delete removes the product permanently.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;

  const existing = await getProductById(id);
  if (!existing) return jsonError(404, "Product not found.");

  try {
    const previousSnapshot = productInvalidationSnapshot(existing);
    await hardDeleteProduct(id);
    await logAdminActivity({
      kind: "product",
      action: "deleted",
      target: existing.name,
      targetId: existing.id,
      href: "/admin/products",
      actor: guard.session.user,
    });
    invalidateProductSnapshots([previousSnapshot], {
      reason: `product deleted: ${existing.id}`,
      sitemap: true,
      categoryTree: true,
    });
    return ok(serializeProduct(existing));
  } catch (error) {
    if (
      error instanceof PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return jsonError(404, "Product not found.");
    }
    console.error("[products/[id].DELETE] failed", error);
    return jsonError(500, "Failed to delete product.");
  }
}
