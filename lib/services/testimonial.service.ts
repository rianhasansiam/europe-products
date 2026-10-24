import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import type {
  AdminTestimonialQueryInput,
  CreateTestimonialFromReviewInput,
  CreateTestimonialInput,
  UpdateTestimonialInput,
} from "@/lib/validations/testimonial.validation";

/**
 * The single home for Testimonial DB logic.
 *
 * Powers the admin-managed "Loved by shoppers" section on the About
 * page. Public reads are cached (and tag-busted on every mutation) so
 * the storefront stays fast; the admin list always reads fresh.
 */

export type TestimonialStatus = "ACTIVE" | "INACTIVE";

const testimonialSelect = {
  id: true,
  name: true,
  location: true,
  image: true,
  rating: true,
  text: true,
  position: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TestimonialSelect;

type TestimonialRow = Prisma.TestimonialGetPayload<{
  select: typeof testimonialSelect;
}>;

export type SerializedTestimonial = {
  id: string;
  name: string;
  location: string | null;
  image: string | null;
  rating: number;
  text: string;
  position: number;
  status: TestimonialStatus;
  createdAt: string;
  updatedAt: string;
};

export function serializeTestimonial(
  row: TestimonialRow,
): SerializedTestimonial {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    image: row.image,
    rating: row.rating,
    text: row.text,
    position: row.position,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const ORDER_BY: Prisma.TestimonialOrderByWithRelationInput[] = [
  { position: "asc" },
  { createdAt: "desc" },
];

/* -------------------------------------------------------------------------- */
/*  Public read (cached) — storefront About page                              */
/* -------------------------------------------------------------------------- */

const getCachedActiveTestimonials = unstable_cache(
  async (): Promise<SerializedTestimonial[]> => {
    const rows = await prisma.testimonial.findMany({
      where: { status: "ACTIVE" },
      orderBy: ORDER_BY,
      select: testimonialSelect,
    });
    return rows.map(serializeTestimonial);
  },
  ["testimonials-active"],
  { revalidate: 3600, tags: ["testimonials"] },
);

export function getActiveTestimonials() {
  return getCachedActiveTestimonials();
}

/* -------------------------------------------------------------------------- */
/*  Admin reads / writes                                                      */
/* -------------------------------------------------------------------------- */

export async function listTestimonialsForAdmin(
  query: AdminTestimonialQueryInput,
) {
  const where: Prisma.TestimonialWhereInput = {};
  if (query.status) where.status = query.status;

  const skip = (query.page - 1) * query.pageSize;

  const [items, total] = await Promise.all([
    prisma.testimonial.findMany({
      where,
      orderBy: ORDER_BY,
      skip,
      take: query.pageSize,
      select: testimonialSelect,
    }),
    prisma.testimonial.count({ where }),
  ]);

  return {
    items: items.map(serializeTestimonial),
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  };
}

export async function createTestimonial(input: CreateTestimonialInput) {
  const row = await prisma.testimonial.create({
    data: {
      name: input.name,
      location: input.location ?? null,
      image: input.image ?? null,
      rating: input.rating,
      text: input.text,
      position: input.position,
      status: input.status,
    },
    select: testimonialSelect,
  });
  return serializeTestimonial(row);
}

/**
 * Promote an existing customer product review into a testimonial.
 *
 * Copies the reviewer's name, avatar, rating, and comment from the
 * review. Requires the review to have written text (an empty rating-only
 * review wouldn't make a useful testimonial). New testimonials are added
 * at the end and default to ACTIVE so they show up immediately.
 */
export async function createTestimonialFromReview(
  input: CreateTestimonialFromReviewInput,
) {
  const review = await prisma.review.findUnique({
    where: { id: input.reviewId },
    select: {
      authorName: true,
      comment: true,
      title: true,
      rating: true,
      user: { select: { image: true } },
    },
  });

  if (!review) {
    throw new ServiceError(404, "Review not found.");
  }

  // Prefer the comment; fall back to the title so a title-only review can
  // still be promoted. Reject when there's nothing to quote.
  const text = (review.comment ?? review.title ?? "").trim();
  if (text.length < 10) {
    throw new ServiceError(
      422,
      "This review has no written feedback to show as a testimonial.",
    );
  }

  const count = await prisma.testimonial.count();

  const row = await prisma.testimonial.create({
    data: {
      name: review.authorName,
      location: input.location ?? null,
      image: review.user?.image ?? null,
      rating: review.rating,
      text,
      position: count,
      status: "ACTIVE",
    },
    select: testimonialSelect,
  });
  return serializeTestimonial(row);
}

export async function updateTestimonial(
  id: string,
  input: UpdateTestimonialInput,
) {
  const data: Prisma.TestimonialUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.location !== undefined) data.location = input.location;
  if (input.image !== undefined) data.image = input.image;
  if (input.rating !== undefined) data.rating = input.rating;
  if (input.text !== undefined) data.text = input.text;
  if (input.position !== undefined) data.position = input.position;
  if (input.status !== undefined) data.status = input.status;

  try {
    const row = await prisma.testimonial.update({
      where: { id },
      data,
      select: testimonialSelect,
    });
    return serializeTestimonial(row);
  } catch (error) {
    if (
      error instanceof PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new ServiceError(404, "Testimonial not found.");
    }
    throw error;
  }
}

export async function deleteTestimonial(id: string): Promise<{ id: string }> {
  try {
    await prisma.testimonial.delete({ where: { id } });
    return { id };
  } catch (error) {
    if (
      error instanceof PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new ServiceError(404, "Testimonial not found.");
    }
    throw error;
  }
}
