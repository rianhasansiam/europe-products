import { adminRoute } from "@/lib/api/handlers";
import { removeProductCost } from "@/lib/services/capital-cost.service";

type Params = { id: string };

/**
 * DELETE /api/admin/capital-costs/product-costs/[id]
 *
 * Admin-only. Remove an explicit product-cost selection.
 */
export const DELETE = adminRoute<unknown, Params>({
  scope: "admin.capital-costs.product-costs/[id].DELETE",
  handler: async ({ params, session }) => {
    const result = await removeProductCost(params.id, {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    });
    return { data: result };
  },
});
