import { adminRoute } from "@/lib/api/handlers";
import { getCapitalCostOverview } from "@/lib/services/capital-cost.service";

/**
 * GET /api/admin/capital-costs/overview
 *
 * Admin only. One-shot snapshot: capital, explicitly selected product
 * costs, the other-cost list, and the headline summary numbers.
 */
export const GET = adminRoute({
  scope: "admin.capital-costs.overview.GET",
  handler: async () => {
    const overview = await getCapitalCostOverview();
    return { data: overview };
  },
});
