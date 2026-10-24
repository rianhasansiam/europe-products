import type { z } from "zod";

import { adminRoute } from "@/lib/api/handlers";
import { listMessagesForAdminCached } from "@/lib/services/contact.service";
import { adminMessageQuerySchema } from "@/lib/validations/contact.validation";

type AdminMessageQuery = z.infer<typeof adminMessageQuerySchema>;

/**
 * GET /api/admin/messages
 *
 * Admin only. Pagination, search across name/email/phone/subject/message,
 * filter by status. Reads are served from the Next.js data cache and
 * busted on demand from the public POST route.
 */
export const GET = adminRoute({
  scope: "admin.messages.GET",
  querySchema: adminMessageQuerySchema,
  handler: async ({ query }) => {
    const { items, meta } = await listMessagesForAdminCached(query as AdminMessageQuery);
    return { data: items, meta };
  },
});
