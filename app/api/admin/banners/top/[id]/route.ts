import { adminJsonRoute, adminRoute } from "@/lib/api/handlers";
import {
  deleteTopBanner,
  updateTopBanner,
} from "@/lib/services/banner.service";
import { updateTopBannerSchema } from "@/lib/validations/banner.validation";

const TOP_TAGS = ["admin-banners", "top-banners"] as const;
const NOT_FOUND = {
  code: "P2025",
  message: "Top banner not found.",
} as const;

type Params = { id: string };

/** PATCH /api/admin/banners/top/[id] — admin only. */
export const PATCH = adminJsonRoute<
  typeof updateTopBannerSchema,
  unknown,
  Params
>({
  schema: updateTopBannerSchema,
  scope: "admin.banners.top/[id].PATCH",
  revalidate: TOP_TAGS,
  notFoundOn: NOT_FOUND,
  handler: async ({ body, params }) => {
    const banner = await updateTopBanner(params.id, body);
    return { data: banner };
  },
});

/** DELETE /api/admin/banners/top/[id] — admin only, hard delete. */
export const DELETE = adminRoute<unknown, Params>({
  scope: "admin.banners.top/[id].DELETE",
  revalidate: TOP_TAGS,
  notFoundOn: NOT_FOUND,
  handler: async ({ params }) => {
    const banner = await deleteTopBanner(params.id);
    return { data: banner };
  },
});
