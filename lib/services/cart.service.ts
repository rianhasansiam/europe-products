import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";

import {
  cleanVariantAttributes,
  formatVariantAttributes,
} from "@/lib/catalog/variant-options";
import { prisma } from "@/lib/db/prisma";
import { multiply, round2, subtractClamped, sumDecimals, toDecimal } from "@/lib/money";
import { ServiceError } from "@/lib/services/service-error";
import {
  getEffectiveActiveCategoryIds,
  isCategoryEffectivelyActive,
} from "@/lib/services/category.service";
import type {
  AddToCartInput,
  SyncCartInput,
  UpdateCartItemInput,
} from "@/lib/validations/cart.validation";

/**
 * The single home for Cart DB logic.
 *
 * Route handlers stay thin. Domain rules live here:
 *   - prices are always read from the DB (never trusted from the client)
 *   - each cart row stores the exact selected ProductVariant, so a
 *     customer who adds "Black / Large" gets that precise item
 *   - inactive products and out-of-stock variants are rejected
 *   - quantity can never exceed the chosen variant's current stock
 *   - all writes are scoped by `userId` in the WHERE clause so a user
 *     can never touch another user's cart row (IDOR-safe by SQL).
 */

/* -------------------------------------------------------------------------- */
/*  Domain error                                                              */
/* -------------------------------------------------------------------------- */

export class CartError extends ServiceError {
  constructor(
    status: number,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(status, message, details);
    this.name = "CartError";
  }
}

/* -------------------------------------------------------------------------- */
/*  Selects / shapes                                                          */
/* -------------------------------------------------------------------------- */

/** Compact product info embedded inside each cart line. */
const cartItemProductSelect = {
  id: true,
  productCode: true,
  name: true,
  slug: true,
  status: true,
  categoryId: true,
  salePrice: true,
  discountPrice: true,
  images: {
    orderBy: { position: "asc" },
    take: 1,
    select: { url: true },
  },
} satisfies Prisma.ProductSelect;

/** The exact selected variant carries the size/color + stock for the line. */
const cartItemVariantSelect = {
  id: true,
  variantKey: true,
  name: true,
  sku: true,
  color: true,
  size: true,
  modelNumber: true,
  attributes: true,
  stock: true,
  isActive: true,
  product: { select: cartItemProductSelect },
} satisfies Prisma.ProductVariantSelect;

const cartItemInclude = {
  variant: { select: cartItemVariantSelect },
} satisfies Prisma.CartItemInclude;

type CartItemWithRelations = Prisma.CartItemGetPayload<{
  include: typeof cartItemInclude;
}>;

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Pick the unit price the customer should pay. Pricing lives on the
 * product now: use the discount price when set and lower than the sale
 * price, otherwise the sale price.
 */
function effectiveProductPrice(product: {
  salePrice: Prisma.Decimal;
  discountPrice: Prisma.Decimal | null;
}): Prisma.Decimal {
  if (
    product.discountPrice != null &&
    toDecimal(product.discountPrice).lessThan(toDecimal(product.salePrice))
  ) {
    return toDecimal(product.discountPrice);
  }
  return toDecimal(product.salePrice);
}

/** Shape returned to the client for one cart row. */
type CartLine = {
  id: string;
  productId: string;
  productCode: string;
  slug: string;
  variantId: string;
  sku: string | null;
  variantKey: string;
  variantName: string | null;
  modelNumber: string | null;
  color: string | null;
  size: string | null;
  attributes: Record<string, string> | null;
  attributeSummary: string | null;
  name: string;
  image: string | null;
  quantity: number;
  unitPrice: number;
  originalPrice: number;
  lineTotal: number;
  stock: number;
  status: "ACTIVE" | "INACTIVE";
};

type CartSummary = {
  totalItems: number;
  subtotal: number;
  totalDiscount: number;
  finalTotal: number;
};

/**
 * Map a DB row into the API line shape and decide whether it should
 * count toward the totals (inactive products are surfaced but ignored
 * in the summary so the UI can warn the user).
 */
function toLine(
  row: CartItemWithRelations,
  activeCategoryIds?: ReadonlySet<string>,
): {
  line: CartLine;
  countable: boolean;
} {
  const variant = row.variant;
  const p = variant.product;
  const attributes = cleanVariantAttributes(variant.attributes);
  const listPrice = toDecimal(p.salePrice);
  const unitPrice = effectiveProductPrice(p);
  const stock = variant.stock;
  const line: CartLine = {
    id: row.id,
    productId: p.id,
    productCode: p.productCode,
    slug: p.slug,
    variantId: variant.id,
    sku: variant.sku,
    variantKey: variant.variantKey,
    variantName: variant.name,
    modelNumber: variant.modelNumber,
    color: variant.color,
    size: variant.size,
    attributes,
    attributeSummary: formatVariantAttributes(attributes),
    name: p.name,
    image: p.images[0]?.url ?? null,
    quantity: row.quantity,
    unitPrice: round2(unitPrice),
    originalPrice: round2(listPrice),
    lineTotal: round2(multiply(unitPrice, row.quantity)),
    stock,
    status:
      p.status === "ACTIVE" &&
      variant.isActive &&
      (!activeCategoryIds || activeCategoryIds.has(p.categoryId))
        ? "ACTIVE"
        : "INACTIVE",
  };
  return {
    line,
    countable: line.status === "ACTIVE",
  };
}

function summarize(
  rows: CartItemWithRelations[],
  activeCategoryIds?: ReadonlySet<string>,
): {
  items: CartLine[];
  summary: CartSummary;
} {
  let totalItems = 0;
  const items: CartLine[] = [];
  const countableLines: CartLine[] = [];

  for (const row of rows) {
    const { line, countable } = toLine(row, activeCategoryIds);
    items.push(line);
    if (!countable) continue;
    countableLines.push(line);
    totalItems += line.quantity;
  }

  const subtotal = round2(sumDecimals(countableLines.map((l) => l.lineTotal)));
  const totalDiscount = round2(
    sumDecimals(
      countableLines.map((l) =>
        subtractClamped(
          multiply(l.originalPrice, l.quantity),
          multiply(l.unitPrice, l.quantity),
        ),
      ),
    ),
  );

  return {
    items,
    summary: {
      totalItems,
      subtotal,
      totalDiscount,
      finalTotal: subtotal,
    },
  };
}

/**
 * Resolve the variant a cart write should target. When the caller
 * passes a `variantId` we validate it belongs to the product; when it
 * is omitted we fall back to the product's primary (oldest) variant so
 * single-variant products keep working without client changes.
 */
async function resolveVariant(
  productId: string,
  variantId: string | undefined,
) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      status: true,
      categoryId: true,
      variants: {
        orderBy: { createdAt: "asc" },
        select: { id: true, stock: true, isActive: true },
      },
    },
  });
  if (!product) throw new CartError(404, "Product not found.");
  if (product.status !== "ACTIVE") {
    throw new CartError(409, `"${product.name}" is no longer available.`);
  }
  if (!(await isCategoryEffectivelyActive(product.categoryId))) {
    throw new CartError(409, `"${product.name}" is no longer available.`);
  }

  const activeVariants = product.variants.filter((item) => item.isActive);

  // When the product has more than one variant, the caller MUST specify
  // which size+color they want. We only fall back to the single variant
  // when there is exactly one (an unambiguous choice).
  if (!variantId && activeVariants.length > 1) {
    throw new CartError(
      400,
      `Please select a size and color for "${product.name}" before adding to the cart.`,
      { productId: product.id, requiresVariantSelection: true },
    );
  }

  const variant = variantId
    ? activeVariants.find((v) => v.id === variantId)
    : activeVariants[0];

  if (!variant) {
    throw new CartError(
      variantId ? 404 : 409,
      variantId
        ? "Selected variant was not found for this product."
        : `"${product.name}" has no purchasable variant.`,
    );
  }
  return { product, variant };
}

/* -------------------------------------------------------------------------- */
/*  Reads                                                                     */
/* -------------------------------------------------------------------------- */

export async function getMyCart(userId: string) {
  const [rows, activeCategoryIds] = await Promise.all([
    prisma.cartItem.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: cartItemInclude,
    }),
    getEffectiveActiveCategoryIds(),
  ]);

  return summarize(rows, new Set(activeCategoryIds));
}

// NOTE: The cart is per-user and is read immediately after every write
// (add / update / remove). A cached read with stale-while-revalidate
// semantics would serve the pre-write cart on that immediate refetch, so
// the cart is intentionally NOT cached. `GET /api/cart` always reads fresh
// from the DB via `getMyCart`.

export async function syncCartItems(userId: string, input: SyncCartInput) {
  if (input.items.length === 0) {
    return getMyCart(userId);
  }

  // Resolve every line to a concrete variant, merging duplicates by
  // the variant that will actually be stored.
  const merged = new Map<
    string,
    { productId: string; variantId: string; quantity: number }
  >();

  for (const item of input.items) {
    let resolved;
    try {
      resolved = await resolveVariant(item.productId, item.variantId);
    } catch {
      // Skip lines that no longer resolve (inactive/deleted product).
      continue;
    }
    const variantId = resolved.variant.id;
    const existing = merged.get(variantId);
    merged.set(variantId, {
      productId: resolved.product.id,
      variantId,
      quantity: (existing?.quantity ?? 0) + item.quantity,
    });
  }

  const requested = Array.from(merged.values());
  if (requested.length === 0) {
    return getMyCart(userId);
  }

  const variantIds = requested.map((item) => item.variantId);
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds } },
    select: { id: true, stock: true },
  });
  const stockByVariantId = new Map(variants.map((v) => [v.id, v.stock]));

  const existingRows = await prisma.cartItem.findMany({
    where: { userId, variantId: { in: variantIds } },
    select: { variantId: true, quantity: true },
  });
  const existingByVariantId = new Map(
    existingRows.map((row) => [row.variantId, row.quantity]),
  );

  // Only create items that don't already exist on the server. Items
  // that the user already has are left untouched so a page refresh
  // never inflates quantities (the old `{ increment }` upsert was
  // adding local quantities to existing server quantities each time).
  const writes = requested.flatMap((item) => {
    const stock = stockByVariantId.get(item.variantId);
    if (stock == null || stock <= 0) return [];

    // Item already exists on the server — keep the server quantity.
    if (existingByVariantId.has(item.variantId)) return [];

    const quantity = Math.min(item.quantity, stock);
    return prisma.cartItem.create({
      data: {
        userId,
        variantId: item.variantId,
        quantity,
      },
    });
  });

  if (writes.length > 0) {
    await prisma.$transaction(writes);
  }

  return getMyCart(userId);
}

/* -------------------------------------------------------------------------- */
/*  Writes                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Add a variant to the cart. If the user already has a row for this
 * exact variant we add to it; otherwise we create a new one. The
 * combined quantity is capped at the variant's `stock`.
 */
export async function addToCart(userId: string, input: AddToCartInput) {
  const { product, variant } = await resolveVariant(
    input.productId,
    input.variantId,
  );

  if (variant.stock <= 0) {
    throw new CartError(409, `"${product.name}" is out of stock.`);
  }

  const existing = await prisma.cartItem.findUnique({
    where: { userId_variantId: { userId, variantId: variant.id } },
    select: { quantity: true },
  });

  const nextQuantity = (existing?.quantity ?? 0) + input.quantity;
  if (nextQuantity > variant.stock) {
    throw new CartError(
      409,
      `Only ${variant.stock} unit(s) of "${product.name}" available.`,
      { available: variant.stock, requested: nextQuantity },
    );
  }

  const row = await prisma.cartItem.upsert({
    where: { userId_variantId: { userId, variantId: variant.id } },
    create: {
      userId,
      variantId: variant.id,
      quantity: input.quantity,
    },
    update: { quantity: nextQuantity },
    include: cartItemInclude,
  });

  return toLine(row).line;
}

/**
 * Update the quantity of a cart row the caller owns.
 *
 * The `where: { id, userId }` scope is the IDOR guard: a user cannot
 * touch another user's row even if they know the id.
 */
export async function updateCartItem(
  itemId: string,
  userId: string,
  input: UpdateCartItemInput,
) {
  const existing = await prisma.cartItem.findFirst({
    where: { id: itemId, userId },
    include: cartItemInclude,
  });
  if (!existing) throw new CartError(404, "Cart item not found.");

  const product = existing.variant.product;
  if (product.status !== "ACTIVE") {
    throw new CartError(409, `"${product.name}" is no longer available.`);
  }
  if (!(await isCategoryEffectivelyActive(product.categoryId))) {
    throw new CartError(409, `"${product.name}" is no longer available.`);
  }
  const stock = existing.variant.stock;
  if (input.quantity > stock) {
    throw new CartError(
      409,
      `Only ${stock} unit(s) of "${product.name}" available.`,
      { available: stock, requested: input.quantity },
    );
  }

  const updated = await prisma.cartItem.update({
    where: { id: existing.id },
    data: { quantity: input.quantity },
    include: cartItemInclude,
  });

  return toLine(updated).line;
}

/** Delete a single cart row owned by the caller. */
export async function removeCartItem(itemId: string, userId: string) {
  const result = await prisma.cartItem.deleteMany({
    where: { id: itemId, userId },
  });
  if (result.count === 0) throw new CartError(404, "Cart item not found.");
  return { id: itemId };
}

/** Empty the caller's cart. Always succeeds (idempotent). */
export async function clearMyCart(userId: string) {
  const result = await prisma.cartItem.deleteMany({ where: { userId } });
  return { deletedCount: result.count };
}

/* -------------------------------------------------------------------------- */
/*  Merge (login: guest cart → server)                                        */
/* -------------------------------------------------------------------------- */

/**
 * Merge guest cart items into an authenticated user's server cart.
 *
 * Unlike `syncCartItems`, which only creates items that don't already exist,
 * this function **adds** the guest quantity to any existing server row (capped
 * at the variant's stock). This is the correct behavior for login-time merge:
 * if the guest had 3× "Black / L" and the server already has 2×, the result
 * is 5× (or stock, whichever is lower).
 */
export async function mergeCartItems(
  userId: string,
  input: SyncCartInput,
) {
  if (input.items.length === 0) {
    return getMyCart(userId);
  }

  // Resolve and dedupe by variant.
  const merged = new Map<
    string,
    { productId: string; variantId: string; quantity: number }
  >();

  for (const item of input.items) {
    let resolved;
    try {
      resolved = await resolveVariant(item.productId, item.variantId);
    } catch {
      // Skip invalid/deleted/inactive items silently.
      continue;
    }
    const variantId = resolved.variant.id;
    const existing = merged.get(variantId);
    merged.set(variantId, {
      productId: resolved.product.id,
      variantId,
      quantity: (existing?.quantity ?? 0) + item.quantity,
    });
  }

  const requested = Array.from(merged.values());
  if (requested.length === 0) {
    return getMyCart(userId);
  }

  // Fetch variant stock and existing server rows.
  const variantIds = requested.map((i) => i.variantId);
  const [variants, existingRows] = await Promise.all([
    prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      select: { id: true, stock: true },
    }),
    prisma.cartItem.findMany({
      where: { userId, variantId: { in: variantIds } },
      select: { id: true, variantId: true, quantity: true },
    }),
  ]);

  const stockByVariant = new Map(variants.map((v) => [v.id, v.stock]));
  const existingByVariant = new Map(
    existingRows.map((r) => [r.variantId, r]),
  );

  const writes: ReturnType<typeof prisma.cartItem.upsert>[] = [];

  for (const item of requested) {
    const stock = stockByVariant.get(item.variantId);
    if (stock == null || stock <= 0) continue;

    const existing = existingByVariant.get(item.variantId);
    const combinedQty = Math.min(
      (existing?.quantity ?? 0) + item.quantity,
      stock,
    );

    writes.push(
      prisma.cartItem.upsert({
        where: {
          userId_variantId: { userId, variantId: item.variantId },
        },
        create: {
          userId,
          variantId: item.variantId,
          quantity: Math.min(item.quantity, stock),
        },
        update: {
          quantity: combinedQty,
        },
      }),
    );
  }

  if (writes.length > 0) {
    await prisma.$transaction(writes);
  }

  return getMyCart(userId);
}
