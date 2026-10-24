import { adminJsonRoute, adminRoute } from "@/lib/api/handlers";
import {
  deleteTestimonial,
  updateTestimonial,
} from "@/lib/services/testimonial.service";
import { updateTestimonialSchema } from "@/lib/validations/testimonial.validation";

const TESTIMONIAL_TAGS = ["testimonials"] as const;

type Params = { id: string };

/**
 * PATCH /api/admin/testimonials/[id]
 *
 * Admin only. Partial update of a testimonial.
 */
export const PATCH = adminJsonRoute<
  typeof updateTestimonialSchema,
  unknown,
  Params
>({
  schema: updateTestimonialSchema,
  scope: "admin.testimonials/[id].PATCH",
  revalidate: TESTIMONIAL_TAGS,
  handler: async ({ body, params }) => {
    const testimonial = await updateTestimonial(params.id, body);
    return { data: testimonial };
  },
});

/**
 * DELETE /api/admin/testimonials/[id]
 *
 * Admin only. Hard-delete a testimonial.
 */
export const DELETE = adminRoute<unknown, Params>({
  scope: "admin.testimonials/[id].DELETE",
  revalidate: TESTIMONIAL_TAGS,
  handler: async ({ params }) => {
    const result = await deleteTestimonial(params.id);
    return { data: result };
  },
});
