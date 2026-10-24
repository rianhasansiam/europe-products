import type { z } from "zod";

import { adminJsonRoute, adminRoute } from "@/lib/api/handlers";
import {
  createTestimonial,
  listTestimonialsForAdmin,
} from "@/lib/services/testimonial.service";
import {
  adminTestimonialQuerySchema,
  createTestimonialSchema,
} from "@/lib/validations/testimonial.validation";

type AdminTestimonialQuery = z.infer<typeof adminTestimonialQuerySchema>;

/**
 * GET /api/admin/testimonials
 *
 * Admin only. Paginated list, optional status filter, ordered by
 * position then newest.
 */
export const GET = adminRoute({
  scope: "admin.testimonials.GET",
  querySchema: adminTestimonialQuerySchema,
  handler: async ({ query }) => {
    const { items, meta } = await listTestimonialsForAdmin(
      query as AdminTestimonialQuery,
    );
    return { data: items, meta };
  },
});

/**
 * POST /api/admin/testimonials
 *
 * Admin only. Add a testimonial to the About page section.
 */
export const POST = adminJsonRoute({
  schema: createTestimonialSchema,
  scope: "admin.testimonials.POST",
  revalidate: ["testimonials"],
  handler: async ({ body }) => {
    const testimonial = await createTestimonial(body);
    return { status: 201, data: testimonial };
  },
});
