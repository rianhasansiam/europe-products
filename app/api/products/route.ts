import type { NextRequest } from "next/server";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import { z } from "zod";

import { isAdminRequest, requireAdmin } from "@/lib/api/guards";
import { created, jsonError, ok } from "@/lib/api/response";
import {
  invalidateProductSnapshots,
  productInvalidationSnapshot,
} from "@/lib/cache/catalog-invalidation";
import { logAdminActivity } from "@/lib/services/admin-activity.service";
import {
  createProduct,
  listProducts,
  ProductError,
  serializeProduct,
  type ProductWithCategory,
} from "@/lib/services/product.service";
import {
  createProductSchema,
  productQuerySchema,
} from "@/lib/validations/product.validation";
import { apiLocale, localizeProductSnapshots } from "@/lib/translations/public";

/**
 * GET /api/products
 *
 * Public listing with pagination, search, filtering, and sorting.
 * All knobs come from the query string; see `productQuerySchema`.
 */
export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = productQuerySchema.safeParse(params);

  if (!parsed.success) {
    return jsonError(400, "Invalid query parameters.", {
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    });
  }

  try {
    const isAdmin = await isAdminRequest();
    // Anonymous/public callers can only list visible products. Admin callers
    // keep the full status filter behavior used by the product dashboard.
    const query = isAdmin
      ? parsed.data
      : { ...parsed.data, status: "ACTIVE" as const };
    const { items, meta } = await listProducts(query, {
      publicOnly: !isAdmin,
    });
    const serialized=items.map((item: ProductWithCategory) =>
        serializeProduct(item),
      );
    return ok(params.locale ? await localizeProductSnapshots(serialized,await apiLocale(request)) : serialized,meta);
  } catch (error) {
    console.error("[products.GET] failed", error);
    return jsonError(500, "Failed to fetch products.");
  }
}

/**
 * POST /api/products
 *
 * Admin-only. Creates a product and returns it with its category.
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

  const parsed = createProductSchema.safeParse(body);
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

  try {
    const product = await createProduct(parsed.data);
    await logAdminActivity({
      kind: "product",
      action: "created",
      target: product.name,
      targetId: product.id,
      href: "/admin/products",
      actor: guard.session.user,
    });
    invalidateProductSnapshots([productInvalidationSnapshot(product)], {
      reason: `product created: ${product.id}`,
      sitemap: true,
      categoryTree: true,
    });
    return created(serializeProduct(product));
  } catch (error) {
    if (error instanceof ProductError) {
      return jsonError(error.status, error.message, error.details);
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
    console.error("[products.POST] failed", error);
    return jsonError(500, "Failed to create product.");
  }
}
