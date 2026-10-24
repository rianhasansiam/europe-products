import { adminJsonRoute, adminRoute } from "@/lib/api/handlers";
import {
  getStoreSettingsCached,
  updateStoreSettings,
} from "@/lib/services/settings.service";
import { updateStoreSettingsSchema } from "@/lib/validations/settings.validation";

/**
 * GET /api/admin/settings
 *
 * Admin only. Returns the singleton store settings row, auto-creating
 * it on first read so the form always has something to bind against.
 */
export const GET = adminRoute({
  scope: "admin.settings.GET",
  handler: async () => {
    const settings = await getStoreSettingsCached();
    return { data: settings };
  },
});

/**
 * PATCH /api/admin/settings
 *
 * Admin only. Updates tax rate, delivery charges, and the free-
 * shipping threshold. Busts both the admin tag and the customer-
 * facing `cart` tag so the cart pricing can pick up the change on
 * the next request.
 */
export const PATCH = adminJsonRoute({
  schema: updateStoreSettingsSchema,
  scope: "admin.settings.PATCH",
  revalidate: ["store-settings", "cart"],
  handler: async ({ body }) => {
    const settings = await updateStoreSettings(body);
    return { data: settings };
  },
});
