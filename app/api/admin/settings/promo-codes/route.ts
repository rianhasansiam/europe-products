import { adminJsonRoute, adminRoute } from "@/lib/api/handlers";
import {
  createPromoCode,
  listPromoCodesCached,
} from "@/lib/services/settings.service";
import { createPromoCodeSchema } from "@/lib/validations/settings.validation";

/**
 * GET /api/admin/settings/promo-codes
 *
 * Admin only. Returns every promo code with usage stats and lifecycle
 * dates. Reads pass through `unstable_cache` (tag `promo-codes`).
 */
export const GET = adminRoute({
  scope: "admin.settings.promo-codes.GET",
  handler: async () => {
    const items = await listPromoCodesCached();
    return { data: items };
  },
});

/**
 * POST /api/admin/settings/promo-codes
 *
 * Admin only. Creates a new promo code (case-insensitive). Busts the
 * `promo-codes` tag plus the storefront `cart` tag so any open cart
 * can apply the new code on the next pricing pass.
 */
export const POST = adminJsonRoute({
  schema: createPromoCodeSchema,
  scope: "admin.settings.promo-codes.POST",
  revalidate: ["promo-codes", "cart"],
  handler: async ({ body }) => {
    const promo = await createPromoCode(body);
    return { status: 201, data: promo };
  },
});
