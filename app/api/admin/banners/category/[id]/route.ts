import { adminJsonRoute, adminRoute } from "@/lib/api/handlers";
import { catalogCacheTags } from "@/lib/cache/catalog-tags";
import {
  deleteCategoryBanner,
  updateCategoryBanner,
} from "@/lib/services/banner.service";
import { updateCategoryBannerSchema } from "@/lib/validations/banner.validation";

const CATEGORY_TAGS = [
  "admin-banners",
  "category-banners",
  catalogCacheTags.homepage,
] as const;
const NOT_FOUND = {
  code: "P2025",
  message: "Category banner not found.",
} as const;

type Params = { id: string };

/** PATCH /api/admin/banners/category/[id] — admin only. */
export const PATCH = adminJsonRoute<
  typeof updateCategoryBannerSchema,
  unknown,
  Params
>({
  schema: updateCategoryBannerSchema,
  scope: "admin.banners.category/[id].PATCH",
  revalidate: CATEGORY_TAGS,
  notFoundOn: NOT_FOUND,
  handler: async ({ body, params }) => {
    const banner = await updateCategoryBanner(params.id, body);
    return { data: banner };
  },
});

/** DELETE /api/admin/banners/category/[id] — admin only, hard delete. */
export const DELETE = adminRoute<unknown, Params>({
  scope: "admin.banners.category/[id].DELETE",
  revalidate: CATEGORY_TAGS,
  notFoundOn: NOT_FOUND,
  handler: async ({ params }) => {
    const banner = await deleteCategoryBanner(params.id);
    return { data: banner };
  },
});
