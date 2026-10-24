import { z } from "zod";

/**
 * Zod schemas for the Report API.
 *
 * The admin "Reports" page asks the API for a packaged dataset for a
 * given report type and date window. The server does all aggregation
 * (revenue, top products, stock summaries, etc.) and the client renders
 * the preview / PDF from that payload.
 */

export const REPORT_TYPES = [
  "sales",
  "orders",
  "products",
  "profit",
  "inventory",
  "customers",
  "categories",
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

/** Query string for `GET /api/admin/reports`. */
export const reportQuerySchema = z
  .object({
    type: z.enum(REPORT_TYPES),
    // ISO date strings (YYYY-MM-DD or full ISO). Both inclusive.
    from: z
      .string()
      .trim()
      .min(1)
      .max(40)
      .optional()
      .refine(
        (v) => v === undefined || !Number.isNaN(new Date(v).getTime()),
        { message: "Invalid 'from' date." },
      ),
    to: z
      .string()
      .trim()
      .min(1)
      .max(40)
      .optional()
      .refine(
        (v) => v === undefined || !Number.isNaN(new Date(v).getTime()),
        { message: "Invalid 'to' date." },
      ),
    // Caps for sub-lists embedded inside aggregated reports.
    limit: z.coerce.number().int().min(1).max(500).default(50),
    // When "true", ignore from/to and cover the entire data history.
    allTime: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => value === "true"),
  })
  .superRefine((value, ctx) => {
    if (!value.allTime && value.from && value.to) {
      const from = new Date(value.from).getTime();
      const to = new Date(value.to).getTime();
      if (from > to) {
        ctx.addIssue({
          code: "custom",
          path: ["to"],
          message: "'to' must be on or after 'from'.",
        });
      }
    }
  });

export type ReportQueryInput = z.infer<typeof reportQuerySchema>;
