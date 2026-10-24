import type { z } from "zod";

import { adminRoute } from "@/lib/api/handlers";
import { buildReport } from "@/lib/services/report.service";
import { reportQuerySchema } from "@/lib/validations/report.validation";

type ReportQuery = z.infer<typeof reportQuerySchema>;

/**
 * GET /api/admin/reports
 *
 * Admin only. Returns a fully aggregated payload for the requested
 * report type and date window. The client renders the preview and
 * generates the PDF entirely from this response.
 */
export const GET = adminRoute({
  scope: "admin.reports.GET",
  querySchema: reportQuerySchema,
  handler: async ({ query }) => {
    const data = await buildReport(query as ReportQuery);
    return { data };
  },
});
