import { z } from "zod";

const CATEGORY_STATUS = ["ACTIVE", "INACTIVE"] as const;
const SORT_VALUES = ["position", "name", "latest", "oldest"] as const;

const name = z
  .string()
  .trim()
  .min(2, "Category name is too short.")
  .max(80, "Category name is too long.");

const description = z
  .string()
  .trim()
  .max(2000, "Description is too long.")
  .optional()
  .nullable();

const image = z.string().trim().max(2048).optional().nullable();
const seoTitle = z
  .string()
  .trim()
  .max(70, "SEO title is too long.")
  .optional()
  .nullable();
const metaDescription = z
  .string()
  .trim()
  .max(320, "Meta description is too long.")
  .optional()
  .nullable();
const ogImage = z
  .string()
  .trim()
  .max(2048, "Open Graph image URL is too long.")
  .optional()
  .nullable();
const parentId = z.string().trim().min(1).max(191).nullable();
const position = z.number().int().min(0).max(1_000_000);

export const createCategorySchema = z
  .object({
    name,
    description,
    image,
    seoTitle,
    metaDescription,
    ogImage,
    status: z.enum(CATEGORY_STATUS).default("ACTIVE"),
    parentId: parentId.optional().default(null),
    position: position.optional(),
  })
  .strict();

export const updateCategorySchema = z
  .object({
    name: name.optional(),
    description,
    image,
    seoTitle,
    metaDescription,
    ogImage,
    status: z.enum(CATEGORY_STATUS).optional(),
    parentId: parentId.optional(),
    position: position.optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update.",
  });

const booleanQueryParam = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const parentQueryParam = z
  .string()
  .trim()
  .min(1)
  .max(191)
  .transform((value) =>
    value === "root" || value === "null" ? null : value,
  )
  .optional();

export const categoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(20),
  search: z.string().trim().min(1).max(120).optional(),
  status: z.enum(CATEGORY_STATUS).optional(),
  parentId: parentQueryParam,
  sort: z.enum(SORT_VALUES).default("position"),
  view: z.enum(["flat", "tree"]).default("flat"),
  withCounts: booleanQueryParam.default(true),
  // Compatibility with the original admin client. Counts are now always
  // included, but accepting this parameter avoids breaking older callers.
  withProductCount: booleanQueryParam.default(false),
});

export const reorderCategoriesSchema = z
  .object({
    parentId,
    orderedIds: z
      .array(z.string().trim().min(1).max(191))
      .max(10_000)
      .refine((ids) => new Set(ids).size === ids.length, {
        message: "orderedIds must not contain duplicates.",
      }),
  })
  .strict();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CategoryQueryInput = z.infer<typeof categoryQuerySchema>;
export type ReorderCategoriesInput = z.infer<typeof reorderCategoriesSchema>;
