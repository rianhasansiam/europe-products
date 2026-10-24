import { adminJsonRoute } from "@/lib/api/handlers";
import { createTestimonialFromReview } from "@/lib/services/testimonial.service";
import { createTestimonialFromReviewSchema } from "@/lib/validations/testimonial.validation";

/**
 * POST /api/admin/testimonials/from-review
 *
 * Admin only. Promotes an existing customer product review into a
 * testimonial shown on the About page.
 */
export const POST = adminJsonRoute({
  schema: createTestimonialFromReviewSchema,
  scope: "admin.testimonials.from-review.POST",
  revalidate: ["testimonials"],
  handler: async ({ body }) => {
    const testimonial = await createTestimonialFromReview(body);
    return { status: 201, data: testimonial };
  },
});
