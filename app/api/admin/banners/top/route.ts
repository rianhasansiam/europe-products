import { adminJsonRoute } from "@/lib/api/handlers";
import { createTopBanner } from "@/lib/services/banner.service";
import { createTopBannerSchema } from "@/lib/validations/banner.validation";

/**
 * POST /api/admin/banners/top
 *
 * Admin only. Adds a new top promotional strip slide. Busts
 * `admin-banners` and `top-banners` so any storefront reader sees the
 * new slide on the next request.
 */
export const POST = adminJsonRoute({
  schema: createTopBannerSchema,
  scope: "admin.banners.top.POST",
  revalidate: ["admin-banners", "top-banners"],
  handler: async ({ body }) => {
    const banner = await createTopBanner(body);
    return { status: 201, data: banner };
  },
});
