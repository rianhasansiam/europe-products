import { z } from "zod";

export const catalogSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(150),
  productLimit: z.coerce.number().int().min(1).max(12).default(6),
  categoryLimit: z.coerce.number().int().min(1).max(12).default(5),
});

export type CatalogSearchQuery = z.infer<typeof catalogSearchQuerySchema>;
