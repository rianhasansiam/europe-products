import { adminJsonRoute, adminRoute } from "@/lib/api/handlers";
import { addCapital, getCapital } from "@/lib/services/capital-cost.service";
import { addCapitalSchema } from "@/lib/validations/capital-cost.validation";

/**
 * GET /api/admin/capital-costs/capital
 *
 * Admin only. The latest capital contribution, or `null` when none exists.
 */
export const GET = adminRoute({
  scope: "admin.capital-costs.capital.GET",
  handler: async () => {
    const capital = await getCapital();
    return { data: capital };
  },
});

/**
 * POST /api/admin/capital-costs/capital
 *
 * Admin only. Append a capital contribution — the running total grows by
 * the submitted amount. Capital is never edited or overwritten.
 */
export const POST = adminJsonRoute({
  schema: addCapitalSchema,
  scope: "admin.capital-costs.capital.POST",
  handler: async ({ body, session }) => {
    const capital = await addCapital(body, {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    });
    return { status: 201, data: capital };
  },
});
