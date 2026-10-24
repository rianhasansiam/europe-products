import type { CartItem, CartSummary } from "@/features/cart/api";

export function computeCartSummary(items: CartItem[]): CartSummary {
  let totalItems = 0;
  let subtotal = 0;
  let totalDiscount = 0;

  for (const item of items) {
    if (item.status !== "ACTIVE") continue;
    totalItems += item.quantity;
    subtotal += item.unitPrice * item.quantity;
    totalDiscount += Math.max(
      0,
      (item.originalPrice - item.unitPrice) * item.quantity,
    );
  }

  subtotal = Math.round(subtotal * 100) / 100;
  totalDiscount = Math.round(totalDiscount * 100) / 100;

  return {
    totalItems,
    subtotal,
    totalDiscount,
    finalTotal: subtotal,
  };
}
