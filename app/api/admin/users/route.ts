import type { z } from "zod";

import { adminRoute } from "@/lib/api/handlers";
import { listUsersForAdminCached } from "@/lib/services/user.service";
import { adminUserQuerySchema } from "@/lib/validations/user.validation";

type AdminUserQuery = z.infer<typeof adminUserQuerySchema>;

/**
 * GET /api/admin/users
 *
 * Admin only. Pagination, search by name/email/phone, filter by role.
 * Each row carries lightweight aggregates (orders count, total spend,
 * last order date) so the customer table can render meaningful data
 * without follow-up requests.
 */
export const GET = adminRoute({
  scope: "admin.users.GET",
  querySchema: adminUserQuerySchema,
  handler: async ({ query }) => {
    const { items, meta } = await listUsersForAdminCached(query as AdminUserQuery);
    return { data: items, meta };
  },
});
