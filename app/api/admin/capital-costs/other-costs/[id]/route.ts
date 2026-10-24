import { adminJsonRoute, adminRoute } from "@/lib/api/handlers";
import {
  deleteOtherCost,
  updateOtherCost,
} from "@/lib/services/capital-cost.service";
import { updateOtherCostSchema } from "@/lib/validations/capital-cost.validation";

type Params = { id: string };

/**
 * PATCH /api/admin/capital-costs/other-costs/[id]
 *
 * Admin only. Partial update of a manual cost record.
 */
export const PATCH = adminJsonRoute<typeof updateOtherCostSchema, unknown, Params>(
  {
    schema: updateOtherCostSchema,
    scope: "admin.capital-costs.other-costs/[id].PATCH",
    notFoundOn: { code: "P2025", message: "Cost record not found." },
    handler: async ({ body, params, session }) => {
      const cost = await updateOtherCost(params.id, body, {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      });
      return { data: cost };
    },
  },
);

/**
 * DELETE /api/admin/capital-costs/other-costs/[id]
 *
 * Admin only. Hard-delete a manual cost record.
 */
export const DELETE = adminRoute<unknown, Params>({
  scope: "admin.capital-costs.other-costs/[id].DELETE",
  notFoundOn: { code: "P2025", message: "Cost record not found." },
  handler: async ({ params, session }) => {
    const result = await deleteOtherCost(params.id, {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    });
    return { data: result };
  },
});
