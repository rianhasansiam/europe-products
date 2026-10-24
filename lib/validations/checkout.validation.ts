import { z } from "zod";
import { PHONE_REGEX } from "@/lib/auth/policy";

/**
 * Zod schemas for the Checkout API.
 *
 * Notes:
 *  - Items are optional on every checkout call. When omitted, the
 *    cart is loaded server-side from `CartItem` for the authenticated
 *    user. Pass `items` directly for the "Buy now" flow.
 *  - Prices, taxes, and shipping are NEVER read from the client; the
 *    service recomputes everything from the DB. The body only carries
 *    the customer's choices (items, address, promo code, payment).
 */

const PAYMENT_METHOD = ["AIRWALLEX"] as const;
const DELIVERY_ZONES = ["INSIDE_DHAKA", "OUTSIDE_DHAKA"] as const;

const checkoutItem = z.object({
  productId: z.string().trim().min(1, "Product is required."),
  variantId: z.string().trim().min(1).optional(),
  quantity: z
    .number({ error: "Quantity must be a number." })
    .int("Quantity must be a whole number.")
    .positive("Quantity must be at least 1.")
    .max(1000, "Quantity is too large."),
});

/**
 * Body for `POST /api/checkout/preview`.
 *
 * Guests provide explicit items; authenticated users may omit them to
 * price their saved cart. Used by cart and checkout to compute totals
 * as the customer changes delivery zone or promo code. Read-only by design.
 */
export const checkoutPreviewSchema = z.object({
  items: z.array(checkoutItem).max(100).optional(),
  deliveryZone: z.enum(DELIVERY_ZONES).default("INSIDE_DHAKA"),
  promoCode: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .optional()
    .nullable(),
});

/**
 * Body for `POST /api/checkout`.
 *
 * Customers may be signed in or guests. Ownership is established on the
 * server, and guests must provide explicit items instead of a saved cart.
 */
const checkoutBaseSchema = z.object({
  items: z.array(checkoutItem).max(100).optional(),
  customerName: z
    .string()
    .trim()
    .min(2, "Name is too short.")
    .max(120, "Name is too long."),
  customerPhone: z
    .string()
    .trim()
    .min(7, "Phone number is too short.")
    .max(20, "Phone number is too long.")
    .regex(PHONE_REGEX, "Enter a valid phone number.")
    .transform((value) => value.replace(/[\s\-()]/g, ""))
    .refine((value) => value.replace(/^\+/, "").length >= 7, "Phone number is too short."),
  customerEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address.")
    .max(160)
    .optional()
    .or(z.literal("")),
  customerAddress: z
    .string()
    .trim()
    .min(5, "Address is too short.")
    .max(500, "Address is too long."),
  customerCity: z
    .string()
    .trim()
    .min(2, "City / district is too short.")
    .max(120, "City / district is too long.")
    .optional()
    .or(z.literal("")),
  deliveryZone: z.enum(DELIVERY_ZONES).default("INSIDE_DHAKA"),
  customerPostalCode: z
    .string()
    .trim()
    .min(3, "Postal code is too short.")
    .max(20, "Postal code is too long.")
    .optional()
    .or(z.literal("")),
  customerNote: z
    .string()
    .trim()
    .max(1000, "Note is too long.")
    .optional()
    .or(z.literal("")),
  paymentMethod: z.enum(PAYMENT_METHOD).default("AIRWALLEX"),
  idempotencyKey: z
    .string()
    .trim()
    .uuid("Payment request ID must be a UUID.")
    .optional(),
  airwallexQuoteToken: z.string().trim().min(80).max(4096).optional(),
  promoCode: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .optional()
    .nullable(),
  // Whether to remove purchased products from the user's cart after a
  // successful order. Full-cart checkout clears every line; an explicit cart
  // selection clears only matching variants.
  clearCart: z.boolean().default(true),
});

export const checkoutSchema = checkoutBaseSchema.superRefine((value, context) => {
  if (!value.idempotencyKey) {
    context.addIssue({
      code: "custom",
      path: ["idempotencyKey"],
      message: "A payment request ID is required for online payment.",
    });
  }
  if (value.paymentMethod === "AIRWALLEX" && !value.airwallexQuoteToken) {
    context.addIssue({
      code: "custom",
      path: ["airwallexQuoteToken"],
      message: "Refresh checkout to obtain a secure payment quote.",
    });
  }
});

/**
 * Body for an admin-created order. Admins choose a registered customer or a
 * guest customer and explicitly select products, so this schema requires at
 * least one item and never falls back to a saved cart.
 */
export const adminCheckoutSchema = checkoutBaseSchema.extend({
  // Staff may create a pending order; payment is completed through Airwallex.
  paymentMethod: z.literal("AIRWALLEX").default("AIRWALLEX"),
  idempotencyKey: z.never().optional(),
  airwallexQuoteToken: z.never().optional(),
  // Public guest checkout installs the secure payment-access cookie. Staff
  // orders require an account owner who can open and pay the reserved order.
  customerId: z.string().trim().min(1, "Select a registered customer. Guests must use public checkout."),
  items: z
    .array(checkoutItem)
    .min(1, "Add at least one product.")
    .max(100),

});

/** Read-only server-side quote for the admin order form. */
export const adminCheckoutPreviewSchema = z.object({
  items: z
    .array(checkoutItem)
    .min(1, "Add at least one product.")
    .max(100),
  deliveryZone: z.enum(DELIVERY_ZONES).default("INSIDE_DHAKA"),
  promoCode: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .optional()
    .nullable(),
});

export type CheckoutPreviewInput = z.infer<typeof checkoutPreviewSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type AdminCheckoutInput = z.infer<typeof adminCheckoutSchema>;
export type AdminCheckoutPreviewInput = z.infer<
  typeof adminCheckoutPreviewSchema
>;
