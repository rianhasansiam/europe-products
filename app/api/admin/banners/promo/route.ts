import { adminJsonRoute } from "@/lib/api/handlers";
import { createPromoBanner } from "@/lib/services/banner.service";
import { createPromoBannerSchema } from "@/lib/validations/banner.validation";

/**
 * POST /api/admin/banners/promo
 *
 * Admin only. Adds a new product-details side-rail promo banner.
 * Busts the admin aggregate plus the public `promo-banners` tag.
 */
export const POST = adminJsonRoute({
  schema: createPromoBannerSchema,
  scope: "admin.banners.promo.POST",
  revalidate: ["admin-banners", "promo-banners"],
  handler: async ({ body }) => {
    const banner = await createPromoBanner(body);
    return { status: 201, data: banner };
  },
});
