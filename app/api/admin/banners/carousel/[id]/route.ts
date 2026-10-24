import { adminJsonRoute, adminRoute } from "@/lib/api/handlers";
import {
  deleteCarouselBanner,
  updateCarouselBanner,
} from "@/lib/services/banner.service";
import { updateCarouselBannerSchema } from "@/lib/validations/banner.validation";

const CAROUSEL_TAGS = ["admin-banners", "carousel-banners"] as const;
const NOT_FOUND = {
  code: "P2025",
  message: "Carousel banner not found.",
} as const;

type Params = { id: string };

/** PATCH /api/admin/banners/carousel/[id] — admin only. */
export const PATCH = adminJsonRoute<
  typeof updateCarouselBannerSchema,
  unknown,
  Params
>({
  schema: updateCarouselBannerSchema,
  scope: "admin.banners.carousel/[id].PATCH",
  revalidate: CAROUSEL_TAGS,
  notFoundOn: NOT_FOUND,
  handler: async ({ body, params }) => {
    const banner = await updateCarouselBanner(params.id, body);
    return { data: banner };
  },
});

/** DELETE /api/admin/banners/carousel/[id] — admin only, hard delete. */
export const DELETE = adminRoute<unknown, Params>({
  scope: "admin.banners.carousel/[id].DELETE",
  revalidate: CAROUSEL_TAGS,
  notFoundOn: NOT_FOUND,
  handler: async ({ params }) => {
    const banner = await deleteCarouselBanner(params.id);
    return { data: banner };
  },
});
