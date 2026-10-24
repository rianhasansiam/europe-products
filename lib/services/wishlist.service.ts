import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";

import { prisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import {
  getEffectiveActiveCategoryIds,
  isCategoryEffectivelyActive,
} from "@/lib/services/category.service";
import type {
  AddWishlistItemInput,
  SyncWishlistInput,
} from "@/lib/validations/wishlist.validation";

export class WishlistError extends ServiceError {
  constructor(
    status: number,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(status, message, details);
    this.name = "WishlistError";
  }
}

const wishlistInclude = {
  product: {
    select: {
      id: true,
      productCode: true,
      name: true,
      slug: true,
      status: true,
      salePrice: true,
      discountPrice: true,
      images: {
        orderBy: { position: "asc" },
        take: 1,
        select: { url: true },
      },
      variants: {
        orderBy: { createdAt: "asc" },
        select: { stock: true, isActive: true },
      },
      category: {
        select: { name: true, path: true },
      },
      brand: { select: { name: true } },
      manufacturer: { select: { name: true } },
      reviews: { select: { rating: true } },
    },
  },
} satisfies Prisma.WishlistInclude;

type WishlistWithProduct = Prisma.WishlistGetPayload<{
  include: typeof wishlistInclude;
}>;

export type WishlistUiItem = {
  id: string;
  productCode: string;
  slug: string;
  name: string;
  brand: string;
  image: string;
  price: number;
  originalPrice?: number;
  rating: number;
  reviewCount: number;
  category: string;
  categoryPath: string;
  inStock: boolean;
  variantCount: number;
  addedAt: string;
  priceDropFromAdded?: number;
  badge?: string;
};

const FALLBACK_PRODUCT_IMAGE =
  "https://images.unsplash.com/photo-1542838132-92c53300491e?w=400";

function effectivePrice(product: {
  salePrice: Prisma.Decimal;
  discountPrice: Prisma.Decimal | null;
}) {
  const sale = product.salePrice.toNumber();
  const discount = product.discountPrice?.toNumber() ?? null;
  return discount != null && discount < sale ? discount : sale;
}

function toWishlistUiItem(row: WishlistWithProduct): WishlistUiItem {
  const product = row.product;
  const listPrice = product.salePrice.toNumber();
  const currentPrice = effectivePrice(product);
  const hasValidDiscount = currentPrice < listPrice;
  const stock = product.variants
    .filter((variant) => variant.isActive)
    .reduce((sum, variant) => sum + variant.stock, 0);
  const reviewCount = product.reviews.length;
  const rating =
    reviewCount === 0
      ? 0
      : product.reviews.reduce((sum, review) => sum + review.rating, 0) /
        reviewCount;

  return {
    id: row.product.id,
    productCode: row.product.productCode,
    slug: row.product.slug,
    name: row.product.name,
    brand:
      row.product.brand?.name ?? row.product.manufacturer?.name ?? "Unbranded",
    image: row.product.images[0]?.url ?? FALLBACK_PRODUCT_IMAGE,
    price: currentPrice,
    originalPrice: hasValidDiscount ? listPrice : undefined,
    rating,
    reviewCount,
    category: row.product.category.name,
    categoryPath: row.product.category.path,
    inStock: row.product.status === "ACTIVE" && stock > 0,
    variantCount: row.product.variants.filter((variant) => variant.isActive).length,
    addedAt: row.createdAt.toISOString(),
    badge: undefined,
  };
}

export async function getMyWishlist(userId: string): Promise<WishlistUiItem[]> {
  const activeCategoryIds = await getEffectiveActiveCategoryIds();
  const rows = await prisma.wishlist.findMany({
    where: {
      userId,
      product: {
        status: "ACTIVE",
        categoryId: { in: activeCategoryIds },
      },
    },
    orderBy: { createdAt: "desc" },
    include: wishlistInclude,
  });

  return rows.map(toWishlistUiItem);
}

export async function addWishlistItem(
  userId: string,
  input: AddWishlistItemInput,
): Promise<WishlistUiItem> {
  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    select: { id: true, name: true, status: true, categoryId: true },
  });

  if (!product) {
    throw new WishlistError(404, "Product not found.");
  }
  if (product.status !== "ACTIVE") {
    throw new WishlistError(409, `"${product.name}" is no longer available.`);
  }
  if (!(await isCategoryEffectivelyActive(product.categoryId))) {
    throw new WishlistError(409, `"${product.name}" is no longer available.`);
  }

  const row = await prisma.wishlist.upsert({
    where: {
      userId_productId: {
        userId,
        productId: product.id,
      },
    },
    create: {
      userId,
      productId: product.id,
    },
    update: {},
    include: wishlistInclude,
  });

  return toWishlistUiItem(row);
}

export async function removeWishlistItemByProduct(
  userId: string,
  productId: string,
): Promise<{ id: string }> {
  const result = await prisma.wishlist.deleteMany({
    where: {
      userId,
      productId,
    },
  });

  if (result.count === 0) {
    throw new WishlistError(404, "Wishlist item not found.");
  }

  return { id: productId };
}

export async function clearMyWishlist(userId: string): Promise<{ deletedCount: number }> {
  const result = await prisma.wishlist.deleteMany({ where: { userId } });
  return { deletedCount: result.count };
}

export async function syncWishlistProducts(
  userId: string,
  input: SyncWishlistInput,
): Promise<WishlistUiItem[]> {
  const productIds = Array.from(new Set(input.productIds));
  if (productIds.length === 0) {
    return getMyWishlist(userId);
  }

  const activeCategoryIds = await getEffectiveActiveCategoryIds();
  const activeProducts = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      status: "ACTIVE",
      categoryId: { in: activeCategoryIds },
    },
    select: { id: true },
  });

  if (activeProducts.length > 0) {
    await prisma.wishlist.createMany({
      data: activeProducts.map((product) => ({
        userId,
        productId: product.id,
      })),
      skipDuplicates: true,
    });
  }

  return getMyWishlist(userId);
}
