import { adminJsonRoute } from "@/lib/api/handlers";
import { createCarouselBanner } from "@/lib/services/banner.service";
import { createCarouselBannerSchema } from "@/lib/validations/banner.validation";

/**
 * POST /api/admin/banners/carousel
 *
 * Admin only. Adds a new home page carousel slide and busts the
 * `admin-banners` and `carousel-banners` cache tags so both the admin
 * panel and any storefront readers see the change on next request.
 */
export const POST = adminJsonRoute({
  schema: createCarouselBannerSchema,
  scope: "admin.banners.carousel.POST",
  revalidate: ["admin-banners", "carousel-banners"],
  handler: async ({ body }) => {
    const banner = await createCarouselBanner(body);
    return { status: 201, data: banner };
  },
});
