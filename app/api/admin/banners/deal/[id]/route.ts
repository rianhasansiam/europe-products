import { adminJsonRoute, adminRoute } from "@/lib/api/handlers";
import {
  deleteDealBanner,
  updateDealBanner,
} from "@/lib/services/banner.service";
import { updateDealBannerSchema } from "@/lib/validations/banner.validation";

const DEAL_TAGS = ["admin-banners", "deal-banners"] as const;
const NOT_FOUND = {
  code: "P2025",
  message: "Deal banner not found.",
} as const;

type Params = { id: string };

/** PATCH /api/admin/banners/deal/[id] — admin only. */
export const PATCH = adminJsonRoute<
  typeof updateDealBannerSchema,
  unknown,
  Params
>({
  schema: updateDealBannerSchema,
  scope: "admin.banners.deal/[id].PATCH",
  revalidate: DEAL_TAGS,
  notFoundOn: NOT_FOUND,
  handler: async ({ body, params }) => {
    const banner = await updateDealBanner(params.id, body);
    return { data: banner };
  },
});

/** DELETE /api/admin/banners/deal/[id] — admin only, hard delete. */
export const DELETE = adminRoute<unknown, Params>({
  scope: "admin.banners.deal/[id].DELETE",
  revalidate: DEAL_TAGS,
  notFoundOn: NOT_FOUND,
  handler: async ({ params }) => {
    const banner = await deleteDealBanner(params.id);
    return { data: banner };
  },
});
