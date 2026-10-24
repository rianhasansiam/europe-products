import type { z } from "zod";

import { adminJsonRoute, adminRoute } from "@/lib/api/handlers";
import { invalidateProductsById } from "@/lib/cache/catalog-invalidation";
import { placeOrderForCustomer } from "@/lib/services/checkout.service";
import {
  getOrderForAdmin,
  listOrdersForAdminCached,
} from "@/lib/services/order.service";
import {
  adminCheckoutSchema,
} from "@/lib/validations/checkout.validation";
import { adminOrderQuerySchema } from "@/lib/validations/order.validation";

type AdminOrderQuery = z.infer<typeof adminOrderQuerySchema>;

/**
 * GET /api/admin/orders
 *
 * Admin only. Pagination and search by order number/customer contact;
 * filters by order status, payment status, and guest/registered association.
 * Newest first, with contact/delivery snapshots and the count of items.
 */



export const GET = adminRoute({
  scope: "admin.orders.GET",
  querySchema: adminOrderQuerySchema,
  handler: async ({ query }) => {
    const { items, meta } = await listOrdersForAdminCached(query as AdminOrderQuery);
    return { data: items, meta };
  },
});

/**
 * POST /api/admin/orders
 *
 * Admin-only order placement for either an existing customer account or a
 * guest customer. It uses the same checkout service as customer checkout, so
 * product prices, delivery, tax, promotions, stock, buying-cost snapshots,
 * revenue, and profit all remain consistent across the system.
 */
export const POST = adminJsonRoute({
  scope: "admin.orders.POST",
  schema: adminCheckoutSchema,
  revalidate: ["admin-orders", "promo-codes"],
  handler: async ({ body }) => {
    const { customerId, ...checkoutInput } = body;
    const result = await placeOrderForCustomer(customerId, {
      ...checkoutInput,
      clearCart: false,
    });
    await invalidateProductsById(
      result.order.items.flatMap((item) =>
        item.productId ? [item.productId] : [],
      ),
      { reason: `admin order stock decrement: ${result.order.id}` },
    );
    const order = await getOrderForAdmin(result.order.id);

    if (!order) {
      throw new Error("Created order could not be loaded.");
    }

    return {
      status: 201,
      data: {
        order,
        summary: result.summary,
        promo: result.promo,
      },
    };
  },
});
