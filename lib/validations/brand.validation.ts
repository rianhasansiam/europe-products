import { z } from "zod";

export const BRAND_STATUS_VALUES = ["ACTIVE", "INACTIVE"] as const;

const name = z
  .string()
  .trim()
  .min(2, "Brand name is too short.")
  .max(120, "Brand name is too long.");

const slug = z
  .string()
  .trim()
  .min(1, "Brand slug is required.")
  .max(160, "Brand slug is too long.")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Brand slug must use lowercase letters, numbers, and single hyphens.",
  );

const optionalText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${label} is too long.`)
    .optional()
    .nullable();

function isHttpUrl(value: string): boolean {
  if (value.length === 0) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const website = optionalText("Website", 2048).refine(
  (value) => value == null || isHttpUrl(value),
  "Enter a valid http:// or https:// website.",
);

const brandFields = {
  name,
  description: optionalText("Description", 2000),
  logo: optionalText("Logo URL", 2048),
  website,
  seoTitle: optionalText("SEO title", 70),
  metaDescription: optionalText("Meta description", 320),
  ogImage: optionalText("Open Graph image URL", 2048),
  status: z.enum(BRAND_STATUS_VALUES),
};

export const createBrandSchema = z.object({
  ...brandFields,
  status: brandFields.status.default("ACTIVE"),
});

export const updateBrandSchema = z
  .object({
    name: brandFields.name.optional(),
    slug: slug.optional(),
    description: brandFields.description,
    logo: brandFields.logo,
    website: brandFields.website,
    seoTitle: brandFields.seoTitle,
    metaDescription: brandFields.metaDescription,
    ogImage: brandFields.ogImage,
    status: brandFields.status.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update.",
  });

export const brandQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(120).optional(),
  status: z.enum(BRAND_STATUS_VALUES).optional(),
  sort: z.enum(["name", "latest", "oldest"]).default("name"),
});

export type CreateBrandInput = z.infer<typeof createBrandSchema>;
export type UpdateBrandInput = z.infer<typeof updateBrandSchema>;
export type BrandQueryInput = z.infer<typeof brandQuerySchema>;
