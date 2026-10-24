import { adminJsonRoute, adminRoute } from "@/lib/api/handlers";
import {
  addProductCosts,
  listProductCostOptions,
} from "@/lib/services/capital-cost.service";
import { addProductCostsSchema } from "@/lib/validations/capital-cost.validation";

/**
 * GET /api/admin/capital-costs/product-costs
 *
 * Admin-only product picker data. This is intentionally separate from the
 * public product API because it includes the private buying price.
 */
export const GET = adminRoute({
  scope: "admin.capital-costs.product-costs.GET",
  handler: async () => ({ data: await listProductCostOptions() }),
});

/**
 * POST /api/admin/capital-costs/product-costs
 *
 * Admin-only. Explicitly add selected catalog products to the cost tracker.
 */
export const POST = adminJsonRoute({
  schema: addProductCostsSchema,
  scope: "admin.capital-costs.product-costs.POST",
  handler: async ({ body, session }) => {
    const productCost = await addProductCosts(body, {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    });
    return { status: 201, data: productCost };
  },
});
