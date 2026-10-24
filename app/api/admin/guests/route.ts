import type { z } from "zod";

import { adminRoute } from "@/lib/api/handlers";
import { listGuestCustomersForAdmin } from "@/lib/services/guest-customer.service";
import { adminGuestQuerySchema } from "@/lib/validations/user.validation";

/** Admin-only contact profiles, with guest-owned order totals and pagination. */
export const GET = adminRoute({
  scope: "admin.guests.GET",
  querySchema: adminGuestQuerySchema,
  handler: async ({ query }) => {
    const { items, meta } = await listGuestCustomersForAdmin(
      query as z.infer<typeof adminGuestQuerySchema>,
    );
    return { data: items, meta };
  },
});
