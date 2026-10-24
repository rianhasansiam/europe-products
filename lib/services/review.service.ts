import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";

import { prisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import type {
  AdminReviewQueryInput,
  CreateAdminReviewInput,
  CreateReviewInput,
  ReviewQueryInput,
} from "@/lib/validations/review.validation";

/**
 * The single home for Review DB logic.
 *
 * Reviews come from two places: customers (must have a DELIVERED order
 * containing the product) and admins (seeded directly). The service
 * keeps that policy in one place so the route handlers stay thin.
 */

const reviewInclude = {
  user: { select: { id: true, name: true, image: true } },
  product: { select: { id: true, name: true, slug: true, productCode: true } },
} satisfies Prisma.ReviewInclude;

type ReviewWithRelations = Prisma.ReviewGetPayload<{
  include: typeof reviewInclude;
}>;

/**
 * Admin-only include/serializer. Adds the reviewer's phone (and email),
 * which must NEVER be exposed on the public product reviews endpoint —
 * that's why the admin path uses its own shape instead of widening the
 * shared `reviewInclude`/`serializeReview`.
 */
const adminReviewInclude = {
  user: { select: { id: true, name: true, image: true, phone: true, email: true } },
  product: { select: { id: true, name: true, slug: true, productCode: true } },
} satisfies Prisma.ReviewInclude;

type AdminReviewWithRelations = Prisma.ReviewGetPayload<{
  include: typeof adminReviewInclude;
}>;

export type SerializedReview = {
  id: string;
  productId: string;
  authorName: string;
  authorImage: string | null;
  rating: number;
  title: string | null;
  comment: string | null;
  source: "CUSTOMER" | "ADMIN";
  verified: boolean;
  createdAt: string;
  updatedAt: string;
  product: { id: string; name: string; slug: string; productCode: string } | null;
};

/**
 * Admin-only serialized shape. Same as `SerializedReview` plus the
 * reviewer's contact info (phone/email), only ever returned from
 * admin-guarded endpoints.
 */
export type AdminSerializedReview = SerializedReview & {
  userId: string | null;
  authorPhone: string | null;
  authorEmail: string | null;
};

/** Normalize a review row for JSON responses. */
export function serializeReview(review: ReviewWithRelations): SerializedReview {
  return {
    id: review.id,
    productId: review.productId,
    authorName: review.authorName,
    authorImage: review.user?.image ?? null,
    rating: review.rating,
    title: review.title,
    comment: review.comment,
    source: review.source,
    verified: review.verified,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
    product: review.product
      ? {
          id: review.product.id,
          name: review.product.name,
          slug: review.product.slug,
          productCode: review.product.productCode,
        }
      : null,
  };
}

/** Admin serializer: the public shape plus the reviewer's contact info. */
function serializeAdminReview(
  review: AdminReviewWithRelations,
): AdminSerializedReview {
  return {
    ...serializeReview(review),
    userId: review.userId,
    authorPhone: review.user?.phone ?? null,
    authorEmail: review.user?.email ?? null,
  };
}

export type ReviewSummary = {
  averageRating: number;
  totalReviews: number;
  distribution: { stars: number; count: number; percentage: number }[];
};

/** Aggregate rating stats for a product (average + 1..5 distribution). */
export async function getProductReviewSummary(
  productId: string,
): Promise<ReviewSummary> {
  const grouped = await prisma.review.groupBy({
    by: ["rating"],
    where: { productId },
    _count: { rating: true },
  });

  const counts = new Map<number, number>();
  for (const row of grouped) counts.set(row.rating, row._count.rating);

  const totalReviews = grouped.reduce(
    (sum, row) => sum + row._count.rating,
    0,
  );
  const ratingSum = grouped.reduce(
    (sum, row) => sum + row.rating * row._count.rating,
    0,
  );
  const averageRating = totalReviews > 0 ? ratingSum / totalReviews : 0;

  // Distribution from 5 stars down to 1 so the UI can render top-to-bottom.
  const distribution = [5, 4, 3, 2, 1].map((stars) => {
    const count = counts.get(stars) ?? 0;
    const percentage =
      totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;
    return { stars, count, percentage };
  });

  return {
    averageRating: Math.round(averageRating * 10) / 10,
    totalReviews,
    distribution,
  };
}

/** Paginated reviews for a single product, newest first, plus summary. */
export async function listProductReviews(query: ReviewQueryInput) {
  const where: Prisma.ReviewWhereInput = { productId: query.productId };
  const skip = (query.page - 1) * query.pageSize;

  const [items, total, summary] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: query.pageSize,
      include: reviewInclude,
    }),
    prisma.review.count({ where }),
    getProductReviewSummary(query.productId),
  ]);

  return {
    items: items.map(serializeReview),
    summary,
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  };
}

/**
 * Has this user received this product? True when they own at least one
 * DELIVERED order whose items reference the product. Gate for customer
 * reviews so only buyers who actually got the product can rate it.
 */
async function hasDeliveredProduct(
  userId: string,
  productId: string,
): Promise<boolean> {
  const delivered = await prisma.order.findFirst({
    where: {
      userId,
      status: "DELIVERED",
      items: { some: { productId } },
    },
    select: { id: true },
  });
  return delivered != null;
}

/**
 * Create a customer review.
 *
 * Enforces: product exists, the user has a DELIVERED order for it, and
 * they haven't already reviewed it. The author name + verified flag are
 * derived server-side, never trusted from the client.
 */
export async function createCustomerReview(
  userId: string,
  input: CreateReviewInput,
): Promise<SerializedReview> {
  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    select: { id: true },
  });
  if (!product) {
    throw new ServiceError(404, "Product not found.");
  }

  const eligible = await hasDeliveredProduct(userId, input.productId);
  if (!eligible) {
    throw new ServiceError(
      403,
      "You can only review products from orders that have been delivered.",
    );
  }

  const existing = await prisma.review.findUnique({
    where: { userId_productId: { userId, productId: input.productId } },
    select: { id: true },
  });
  if (existing) {
    throw new ServiceError(409, "You have already reviewed this product.");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });

  const review = await prisma.review.create({
    data: {
      productId: input.productId,
      userId,
      authorName: user?.name ?? "Customer",
      rating: input.rating,
      title: input.title ?? null,
      comment: input.comment ?? null,
      source: "CUSTOMER",
      verified: true,
    },
    include: reviewInclude,
  });

  return serializeReview(review);
}

/**
 * Create an admin-seeded review for a product. Not tied to a user, so
 * `userId` stays null and `verified` is false. Useful for backfilling
 * testimonials or migrating reviews from another system.
 */
export async function createAdminReview(
  input: CreateAdminReviewInput,
): Promise<SerializedReview> {
  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    select: { id: true },
  });
  if (!product) {
    throw new ServiceError(404, "Product not found.");
  }

  const review = await prisma.review.create({
    data: {
      productId: input.productId,
      userId: null,
      authorName: input.authorName,
      rating: input.rating,
      title: input.title ?? null,
      comment: input.comment ?? null,
      source: "ADMIN",
      verified: false,
    },
    include: reviewInclude,
  });

  return serializeReview(review);
}

/** Admin moderation list: search, filter by rating/source, newest first. */
export async function listReviewsForAdmin(query: AdminReviewQueryInput) {
  const where: Prisma.ReviewWhereInput = {};

  if (query.rating) where.rating = query.rating;
  if (query.source) where.source = query.source;
  if (query.search) {
    where.OR = [
      { authorName: { contains: query.search, mode: "insensitive" } },
      { title: { contains: query.search, mode: "insensitive" } },
      { comment: { contains: query.search, mode: "insensitive" } },
      { product: { name: { contains: query.search, mode: "insensitive" } } },
    ];
  }

  const skip = (query.page - 1) * query.pageSize;

  const [items, total] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: query.pageSize,
      include: adminReviewInclude,
    }),
    prisma.review.count({ where }),
  ]);

  return {
    items: items.map(serializeAdminReview),
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  };
}

/** Hard-delete a review by id. Admin only. Keep productId for cache invalidation. */
export async function deleteReview(
  id: string,
): Promise<{ id: string; productId: string }> {
  try {
    return await prisma.review.delete({
      where: { id },
      select: { id: true, productId: true },
    });
  } catch (error) {
    if (
      error instanceof PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new ServiceError(404, "Review not found.");
    }
    throw error;
  }
}

/**
 * Products the user is eligible to review: in a DELIVERED order and not
 * yet reviewed. Powers the "Write a review" CTA on the orders page so we
 * only offer it for products the customer can actually rate.
 */
export async function listReviewableProducts(userId: string): Promise<
  { productId: string; productName: string; productImage: string | null }[]
> {
  const deliveredItems = await prisma.orderItem.findMany({
    where: {
      productId: { not: null },
      order: { userId, status: "DELIVERED" },
    },
    select: { productId: true, productName: true, productImage: true },
    orderBy: { createdAt: "desc" },
  });

  if (deliveredItems.length === 0) return [];

  const reviewed = await prisma.review.findMany({
    where: { userId },
    select: { productId: true },
  });
  const reviewedIds = new Set(reviewed.map((r) => r.productId));

  // De-dupe by productId (a product may appear in multiple orders) and
  // drop anything already reviewed.
  const seen = new Set<string>();
  const out: {
    productId: string;
    productName: string;
    productImage: string | null;
  }[] = [];
  for (const item of deliveredItems) {
    const productId = item.productId;
    if (!productId || seen.has(productId) || reviewedIds.has(productId)) {
      continue;
    }
    seen.add(productId);
    out.push({
      productId,
      productName: item.productName,
      productImage: item.productImage,
    });
  }

  return out;
}
