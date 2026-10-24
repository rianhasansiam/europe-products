import { adminJsonRoute, adminRoute } from "@/lib/api/handlers";
import {
  deletePromoCode,
  updatePromoCode,
} from "@/lib/services/settings.service";
import { updatePromoCodeSchema } from "@/lib/validations/settings.validation";

const PROMO_CODE_TAGS = ["promo-codes", "cart"] as const;

type Params = { id: string };

/** PATCH /api/admin/settings/promo-codes/[id] — admin only. */
export const PATCH = adminJsonRoute<
  typeof updatePromoCodeSchema,
  unknown,
  Params
>({
  schema: updatePromoCodeSchema,
  scope: "admin.settings.promo-codes/[id].PATCH",
  revalidate: PROMO_CODE_TAGS,
  handler: async ({ body, params }) => {
    const promo = await updatePromoCode(params.id, body);
    return { data: promo };
  },
});

/** DELETE /api/admin/settings/promo-codes/[id] — admin only, hard delete. */
export const DELETE = adminRoute<unknown, Params>({
  scope: "admin.settings.promo-codes/[id].DELETE",
  revalidate: PROMO_CODE_TAGS,
  handler: async ({ params }) => {
    const promo = await deletePromoCode(params.id);
    return { data: promo };
  },
});
