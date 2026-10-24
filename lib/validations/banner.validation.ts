import { z } from "zod";

/**
 * Zod schemas for the Banner admin API.
 *
 * Three independent banner surfaces share a single admin page:
 *   - CarouselBanner: hero rotator on the home page.
 *   - CategoryBanner: side rail attached to a category strip.
 *   - TopBanner: thin promotional strip pinned to the top of the site.
 *
 * Each has its own create / update schema. Status enums mirror the
 * Prisma models so a schema rename here is a TS error.
 */

const STATUS = ["ACTIVE", "INACTIVE"] as const;

/**
 * Carousel slides can paint their hero background two ways:
 *   - "gradient": a `bg-linear-*` gradient built from bgFrom/bgVia/bgTo.
 *   - "solid":    a single `bg-*` utility stored in bgColor.
 * The admin picks one; the storefront reads `bgType` to know which set
 * of color fields to honor.
 */
const BG_TYPE = ["gradient", "solid"] as const;
const HEX_COLOR_VALUE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const url = z.string().trim().min(1, "URL is required.").max(2048);

const optionalUrl = z.string().trim().max(2048).optional().nullable();

const shortText = z.string().trim().min(1).max(120);
const mediumText = z.string().trim().min(1).max(280);
const longText = z.string().trim().min(1).max(500);
const colorText = shortText.refine(
  (value) => !value.startsWith("#") || HEX_COLOR_VALUE.test(value),
  { message: "Color hex code must be valid." },
);
const optionalColorText = colorText.optional().nullable();

/* -------------------------------------------------------------------------- */
/*  Carousel banners                                                          */
/* -------------------------------------------------------------------------- */

const carouselFields = {
  image: url,
  title: shortText,
  subtitle: shortText,
  description: longText,
  badge: shortText,
  bgType: z.enum(BG_TYPE).default("gradient"),
  bgFrom: optionalColorText,
  bgVia: optionalColorText,
  bgTo: optionalColorText,
  bgColor: optionalColorText,
  link: optionalUrl,
  position: z.coerce.number().int().min(0).max(9999).default(0),
  status: z.enum(STATUS).default("ACTIVE"),
};

/**
 * A carousel slide must carry the color fields that match its `bgType`:
 * gradients need at least bgFrom + bgTo; solids need bgColor. This keeps
 * the storefront from rendering a colorless hero.
 */
function carouselColorsAreComplete(data: {
  bgType?: "gradient" | "solid";
  bgFrom?: string | null;
  bgTo?: string | null;
  bgColor?: string | null;
}): boolean {
  if (data.bgType === "solid") {
    return Boolean(data.bgColor && data.bgColor.trim());
  }
  // Default / gradient
  return Boolean(
    data.bgFrom && data.bgFrom.trim() && data.bgTo && data.bgTo.trim(),
  );
}

export const createCarouselBannerSchema = z
  .object(carouselFields)
  .refine(carouselColorsAreComplete, {
    message:
      "Gradient slides need a From and To color; solid slides need a background color.",
    path: ["bgColor"],
  });

export const updateCarouselBannerSchema = z
  .object({
    image: url.optional(),
    title: shortText.optional(),
    subtitle: shortText.optional(),
    description: longText.optional(),
    badge: shortText.optional(),
    bgType: z.enum(BG_TYPE).optional(),
    bgFrom: optionalColorText,
    bgVia: optionalColorText,
    bgTo: optionalColorText,
    bgColor: optionalColorText,
    link: optionalUrl,
    position: z.coerce.number().int().min(0).max(9999).optional(),
    status: z.enum(STATUS).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update.",
  });

/* -------------------------------------------------------------------------- */
/*  Category banners                                                          */
/* -------------------------------------------------------------------------- */

const categoryBannerFields = {
  image: url,
  label: shortText,
  heading: shortText,
  discount: shortText,
  description: longText,
  link: optionalUrl,
  categoryId: z.string().trim().min(1, "Category is required."),
  status: z.enum(STATUS).default("ACTIVE"),
};

export const createCategoryBannerSchema = z.object(categoryBannerFields);

export const updateCategoryBannerSchema = z
  .object({
    image: url.optional(),
    label: shortText.optional(),
    heading: shortText.optional(),
    discount: shortText.optional(),
    description: longText.optional(),
    link: optionalUrl,
    categoryId: z.string().trim().min(1).optional(),
    status: z.enum(STATUS).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update.",
  });

/* -------------------------------------------------------------------------- */
/*  Top banners                                                               */
/* -------------------------------------------------------------------------- */

const topBannerFields = {
  icon: shortText,
  badge: shortText,
  discount: shortText,
  description: mediumText,
  tag: shortText,
  tagIcon: shortText,
  link: optionalUrl,
  position: z.coerce.number().int().min(0).max(9999).default(0),
  status: z.enum(STATUS).default("ACTIVE"),
};

export const createTopBannerSchema = z.object(topBannerFields);

export const updateTopBannerSchema = z
  .object({
    icon: shortText.optional(),
    badge: shortText.optional(),
    discount: shortText.optional(),
    description: mediumText.optional(),
    tag: shortText.optional(),
    tagIcon: shortText.optional(),
    link: optionalUrl,
    position: z.coerce.number().int().min(0).max(9999).optional(),
    status: z.enum(STATUS).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update.",
  });

export type CreateCarouselBannerInput = z.infer<typeof createCarouselBannerSchema>;
export type UpdateCarouselBannerInput = z.infer<typeof updateCarouselBannerSchema>;
export type CreateCategoryBannerInput = z.infer<typeof createCategoryBannerSchema>;
export type UpdateCategoryBannerInput = z.infer<typeof updateCategoryBannerSchema>;
export type CreateTopBannerInput = z.infer<typeof createTopBannerSchema>;
export type UpdateTopBannerInput = z.infer<typeof updateTopBannerSchema>;

/* -------------------------------------------------------------------------- */
/*  Deal banners (product-details horizontal carousel)                        */
/* -------------------------------------------------------------------------- */

const dealFields = {
  image: url,
  title: shortText,
  subtitle: shortText,
  bgClass: colorText,
  link: optionalUrl,
  position: z.coerce.number().int().min(0).max(9999).default(0),
  status: z.enum(STATUS).default("ACTIVE"),
};

export const createDealBannerSchema = z.object(dealFields);

export const updateDealBannerSchema = z
  .object({
    image: url.optional(),
    title: shortText.optional(),
    subtitle: shortText.optional(),
    bgClass: colorText.optional(),
    link: optionalUrl,
    position: z.coerce.number().int().min(0).max(9999).optional(),
    status: z.enum(STATUS).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update.",
  });

/* -------------------------------------------------------------------------- */
/*  Promo banners (product-details side rail)                                 */
/* -------------------------------------------------------------------------- */

const promoFields = {
  image: url,
  title: shortText,
  subtitle: shortText,
  discount: shortText,
  bgClass: colorText,
  link: optionalUrl,
  position: z.coerce.number().int().min(0).max(9999).default(0),
  status: z.enum(STATUS).default("ACTIVE"),
};

export const createPromoBannerSchema = z.object(promoFields);

export const updatePromoBannerSchema = z
  .object({
    image: url.optional(),
    title: shortText.optional(),
    subtitle: shortText.optional(),
    discount: shortText.optional(),
    bgClass: colorText.optional(),
    link: optionalUrl,
    position: z.coerce.number().int().min(0).max(9999).optional(),
    status: z.enum(STATUS).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update.",
  });

export type CreateDealBannerInput = z.infer<typeof createDealBannerSchema>;
export type UpdateDealBannerInput = z.infer<typeof updateDealBannerSchema>;
export type CreatePromoBannerInput = z.infer<typeof createPromoBannerSchema>;
export type UpdatePromoBannerInput = z.infer<typeof updatePromoBannerSchema>;
