import type { z } from "zod";

import { adminJsonRoute, adminRoute } from "@/lib/api/handlers";
import {
  createOtherCost,
  listOtherCosts,
} from "@/lib/services/capital-cost.service";
import {
  createOtherCostSchema,
  otherCostQuerySchema,
} from "@/lib/validations/capital-cost.validation";

type OtherCostQuery = z.infer<typeof otherCostQuerySchema>;

/**
 * GET /api/admin/capital-costs/other-costs
 *
 * Admin only. Filterable list of manual costs. Returns the matched rows
 * plus the Decimal-safe sum of their amounts in `meta.filteredTotalAmount`.
 */
export const GET = adminRoute({
  scope: "admin.capital-costs.other-costs.GET",
  querySchema: otherCostQuerySchema,
  handler: async ({ query }) => {
    const { items, filteredTotalAmount, meta } = await listOtherCosts(
      query as OtherCostQuery,
    );
    return { data: items, meta: { ...meta, filteredTotalAmount } };
  },
});

/**
 * POST /api/admin/capital-costs/other-costs
 *
 * Admin only. Record a new manual cost.
 */
export const POST = adminJsonRoute({
  schema: createOtherCostSchema,
  scope: "admin.capital-costs.other-costs.POST",
  handler: async ({ body, session }) => {
    const cost = await createOtherCost(body, {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    });
    return { status: 201, data: cost };
  },
});
