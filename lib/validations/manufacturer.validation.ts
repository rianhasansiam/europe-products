import { z } from "zod";

export const MANUFACTURER_STATUS_VALUES = ["ACTIVE", "INACTIVE"] as const;

const name = z
  .string()
  .trim()
  .min(2, "Manufacturer name is too short.")
  .max(120, "Manufacturer name is too long.");

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

const manufacturerFields = {
  name,
  description: optionalText("Description", 2000),
  logo: optionalText("Logo URL", 2048),
  website,
  country: optionalText("Country", 120),
  status: z.enum(MANUFACTURER_STATUS_VALUES),
};

export const createManufacturerSchema = z.object({
  ...manufacturerFields,
  status: manufacturerFields.status.default("ACTIVE"),
});

export const updateManufacturerSchema = z
  .object({
    name: manufacturerFields.name.optional(),
    description: manufacturerFields.description,
    logo: manufacturerFields.logo,
    website: manufacturerFields.website,
    country: manufacturerFields.country,
    status: manufacturerFields.status.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update.",
  });

export const manufacturerQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(120).optional(),
  status: z.enum(MANUFACTURER_STATUS_VALUES).optional(),
  sort: z.enum(["name", "latest", "oldest"]).default("name"),
});

export type CreateManufacturerInput = z.infer<
  typeof createManufacturerSchema
>;
export type UpdateManufacturerInput = z.infer<
  typeof updateManufacturerSchema
>;
export type ManufacturerQueryInput = z.infer<typeof manufacturerQuerySchema>;
