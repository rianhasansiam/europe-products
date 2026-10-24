import { adminRoute } from "@/lib/api/handlers";
import { listAllBannersForAdminCached } from "@/lib/services/banner.service";

/**
 * GET /api/admin/banners
 *
 * Admin only. Returns all three banner surfaces (carousel, category,
 * top) in one response so the admin page can hydrate every tab in a
 * single request. Reads pass through `unstable_cache` (tag:
 * `admin-banners`) so the round trip stays cheap on the hot path.
 */
export const GET = adminRoute({
  scope: "admin.banners.GET",
  handler: async () => {
    const data = await listAllBannersForAdminCached();
    return { data };
  },
});
