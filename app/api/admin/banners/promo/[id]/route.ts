import { adminJsonRoute, adminRoute } from "@/lib/api/handlers";
import {
  deletePromoBanner,
  updatePromoBanner,
} from "@/lib/services/banner.service";
import { updatePromoBannerSchema } from "@/lib/validations/banner.validation";

// Public storefront tag + admin aggregate tag both need busting on any
// promo write. Centralised so PATCH and DELETE can't drift apart.
const PROMO_TAGS = ["admin-banners", "promo-banners"] as const;
const NOT_FOUND = {
  code: "P2025",
  message: "Promo banner not found.",
} as const;

type Params = { id: string };

/** PATCH /api/admin/banners/promo/[id] — admin only. */
export const PATCH = adminJsonRoute<
  typeof updatePromoBannerSchema,
  unknown,
  Params
>({
  schema: updatePromoBannerSchema,
  scope: "admin.banners.promo/[id].PATCH",
  revalidate: PROMO_TAGS,
  notFoundOn: NOT_FOUND,
  handler: async ({ body, params }) => {
    const banner = await updatePromoBanner(params.id, body);
    return { data: banner };
  },
});

/** DELETE /api/admin/banners/promo/[id] — admin only, hard delete. */
export const DELETE = adminRoute<unknown, Params>({
  scope: "admin.banners.promo/[id].DELETE",
  revalidate: PROMO_TAGS,
  notFoundOn: NOT_FOUND,
  handler: async ({ params }) => {
    const banner = await deletePromoBanner(params.id);
    return { data: banner };
  },
});
