import { adminJsonRoute } from "@/lib/api/handlers";
import { checkCourierInfo } from "@/lib/services/courier.service";
import { courierCheckSchema } from "@/lib/validations/courier.validation";

/**
 * POST /api/admin/courier
 *
 * Admin only. Looks up a customer's delivery / fraud history across the
 * local couriers via the third-party fraudbd.com API. The upstream API
 * key stays server-side; the client only ever receives the normalised
 * report.
 */
export const POST = adminJsonRoute({
  schema: courierCheckSchema,
  scope: "admin.courier.POST",
  handler: async ({ body }) => {
    const report = await checkCourierInfo(body);
    return { data: report };
  },
});
