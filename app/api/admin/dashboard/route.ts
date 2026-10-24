import { adminRoute } from "@/lib/api/handlers";
import { getDashboardOverview } from "@/lib/services/dashboard.service";

/**
 * GET /api/admin/dashboard
 *
 * Admin only. Bundles every aggregate the dashboard page needs into
 * a single payload (headline stats, sales series, recent orders, top
 * products, activity feed) so the UI loads with one request and one
 * spinner.
 */
export const GET = adminRoute({
  scope: "admin.dashboard.GET",
  handler: async () => {
    const overview = await getDashboardOverview();
    return { data: overview };
  },
});
