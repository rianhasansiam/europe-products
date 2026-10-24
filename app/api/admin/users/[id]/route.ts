import { adminRoute } from "@/lib/api/handlers";
import { jsonError } from "@/lib/api/response";
import { getUserForAdmin } from "@/lib/services/user.service";

type Params = { id: string };

/**
 * GET /api/admin/users/[id]
 *
 * Admin only. Returns the full user profile (without secrets).
 */
export const GET = adminRoute<unknown, Params>({
  scope: "admin.users/[id].GET",
  handler: async ({ params }) => {
    const user = await getUserForAdmin(params.id);
    if (!user) return { raw: jsonError(404, "User not found.") };
    return { data: user };
  },
});
