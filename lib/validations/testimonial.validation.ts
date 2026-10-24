import { z } from "zod";

/**
 * Zod schemas for the Testimonial API.
 *
 * Mirrors the Prisma `Testimonial` model. These power the admin-managed
 * "Loved by shoppers" section on the About page — keep the enum in sync
 * with `TestimonialStatus` in the schema.
 */

const TESTIMONIAL_STATUS = ["ACTIVE", "INACTIVE"] as const;

const name = z
  .string()
  .trim()
  .min(2, "Name is too short.")
  .max(120, "Name is too long.");

const location = z
  .string()
  .trim()
  .max(120, "Location is too long.")
  .optional()
  .nullable();

const image = z.string().trim().max(2048).optional().nullable();

const rating = z
  .number({ error: "Rating is required." })
  .int("Rating must be a whole number.")
  .min(1, "Rating must be at least 1 star.")
  .max(5, "Rating cannot exceed 5 stars.");

const text = z
  .string()
  .trim()
  .min(10, "Testimonial is too short.")
  .max(1000, "Testimonial is too long.");

const position = z.number().int().min(0).max(100000);

/** Body for `POST /api/admin/testimonials`. */
export const createTestimonialSchema = z.object({
  name,
  location,
  image,
  rating: rating.default(5),
  text,
  position: position.default(0),
  status: z.enum(TESTIMONIAL_STATUS).default("ACTIVE"),
});

/**
 * Body for `PATCH /api/admin/testimonials/[id]`.
 *
 * Every field optional, but at least one must be provided so a PATCH
 * can never be a silent no-op.
 */
export const updateTestimonialSchema = z
  .object({
    name: name.optional(),
    location,
    image,
    rating: rating.optional(),
    text: text.optional(),
    position: position.optional(),
    status: z.enum(TESTIMONIAL_STATUS).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update.",
  });

/** Query string for `GET /api/admin/testimonials`. */
export const adminTestimonialQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(100),
  status: z.enum(TESTIMONIAL_STATUS).optional(),
});

/**
 * Body for `POST /api/admin/testimonials/from-review`.
 *
 * Promotes an existing customer product review into a testimonial.
 * The admin may override the reviewer's display location (reviews don't
 * carry one); everything else is copied server-side from the review.
 */
export const createTestimonialFromReviewSchema = z.object({
  reviewId: z.string().trim().min(1, "Review is required."),
  location: location,
});

export type CreateTestimonialInput = z.infer<typeof createTestimonialSchema>;
export type UpdateTestimonialInput = z.infer<typeof updateTestimonialSchema>;
export type AdminTestimonialQueryInput = z.infer<
  typeof adminTestimonialQuerySchema
>;
export type CreateTestimonialFromReviewInput = z.infer<
  typeof createTestimonialFromReviewSchema
>;
