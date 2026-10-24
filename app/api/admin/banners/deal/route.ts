import { adminJsonRoute } from "@/lib/api/handlers";
import { createDealBanner } from "@/lib/services/banner.service";
import { createDealBannerSchema } from "@/lib/validations/banner.validation";

/**
 * POST /api/admin/banners/deal
 *
 * Admin only. Adds a new product-details deal card and busts both the
 * admin aggregate and the public `deal-banners` tag so storefront
 * readers see the change on the next request.
 */
export const POST = adminJsonRoute({
  schema: createDealBannerSchema,
  scope: "admin.banners.deal.POST",
  revalidate: ["admin-banners", "deal-banners"],
  handler: async ({ body }) => {
    const banner = await createDealBanner(body);
    return { status: 201, data: banner };
  },
});
