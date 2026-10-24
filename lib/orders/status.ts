/**
 * Order status — the single source of truth.
 *
 * This module is intentionally framework-free (no `server-only`, no
 * Prisma, no React) so it can be imported from both server services
 * and client components. Prisma generates a structurally identical
 * `OrderStatus` enum from the schema; the union here mirrors it so a
 * rename in one place becomes a TypeScript error in the other.
 *
 * The lifecycle models a real courier pipeline (Amazon / Daraz style):
 *
 *   PENDING → PAYMENT_CONFIRMED → SELLER_TO_PACK → PACKED →
 *   READY_TO_SHIP → WAREHOUSE → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED
 *
 * with three branch flows off the happy path:
 *   - CANCELLED       (any pre-delivery state)
 *   - RETURN_REQUESTED → RETURNED → REFUNDED (post-delivery)
 */

/** Every order status, in lifecycle order. */
export const ORDER_STATUSES = [
  "PENDING",
  "PAYMENT_CONFIRMED",
  "SELLER_TO_PACK",
  "PACKED",
  "READY_TO_SHIP",
  "WAREHOUSE",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "RETURN_REQUESTED",
  "RETURNED",
  "REFUNDED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * The linear fulfillment steps shown in the customer-facing tracker.
 * The branch states (CANCELLED / RETURN_REQUESTED / RETURNED /
 * REFUNDED) are rendered separately, not as steps on this rail.
 */
export const ORDER_TRACKING_STEPS = [
  "PENDING",
  "PAYMENT_CONFIRMED",
  "SELLER_TO_PACK",
  "PACKED",
  "READY_TO_SHIP",
  "WAREHOUSE",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
] as const satisfies readonly OrderStatus[];

/**
 * Allowed forward transitions per status.
 *
 * Rules:
 *   - The happy path advances one step at a time.
 *   - CANCELLED is reachable from any state before DELIVERED.
 *   - RETURN_REQUESTED only after DELIVERED.
 *   - RETURNED only after RETURN_REQUESTED.
 *   - REFUNDED only after RETURNED.
 *   - DELIVERED can also start a return; REFUNDED/CANCELLED are terminal.
 */
export const STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ["PAYMENT_CONFIRMED", "CANCELLED"],
  PAYMENT_CONFIRMED: ["SELLER_TO_PACK", "CANCELLED"],
  SELLER_TO_PACK: ["PACKED", "CANCELLED"],
  PACKED: ["READY_TO_SHIP", "CANCELLED"],
  READY_TO_SHIP: ["WAREHOUSE", "CANCELLED"],
  WAREHOUSE: ["IN_TRANSIT", "CANCELLED"],
  IN_TRANSIT: ["OUT_FOR_DELIVERY", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "CANCELLED"],
  DELIVERED: ["RETURN_REQUESTED"],
  CANCELLED: [],
  RETURN_REQUESTED: ["RETURNED"],
  RETURNED: ["REFUNDED"],
  REFUNDED: [],
};

/**
 * Statuses a customer is allowed to self-cancel from. Once the order is
 * packed and on its way the cancellation has to go through support, so
 * the customer-facing button is hidden past SELLER_TO_PACK.
 */
export const CUSTOMER_CANCELLABLE_STATUSES = [
  "PENDING",
  "PAYMENT_CONFIRMED",
  "SELLER_TO_PACK",
] as const satisfies readonly OrderStatus[];

/** Tailwind tones for the two badge shapes used across the app. */
export type OrderStatusTone = {
  /** Solid-ish pill: `bg-* text-*`. */
  pill: string;
  /** Ringed chip: `bg-* text-* ring-*`. */
  ring: string;
};

export type OrderStatusMeta = {
  /** Short label for badges/tables. */
  label: string;
  /** Customer-friendly label for the tracker rail. */
  customerLabel: string;
  /** One-line description shown under the tracker step. */
  description: string;
  tone: OrderStatusTone;
};

export const ORDER_STATUS_META: Record<OrderStatus, OrderStatusMeta> = {
  PENDING: {
    label: "Pending",
    customerLabel: "Order Placed",
    description: "Your order has been placed successfully.",
    tone: {
      pill: "bg-amber-100 text-amber-700",
      ring: "bg-amber-50 text-amber-700 ring-amber-200",
    },
  },
  PAYMENT_CONFIRMED: {
    label: "Payment Confirmed",
    customerLabel: "Payment Confirmed",
    description: "We've verified your payment.",
    tone: {
      pill: "bg-sky-100 text-sky-700",
      ring: "bg-sky-50 text-sky-700 ring-sky-200",
    },
  },
  SELLER_TO_PACK: {
    label: "Preparing",
    customerLabel: "Seller Preparing Package",
    description: "The seller is preparing your items.",
    tone: {
      pill: "bg-indigo-100 text-indigo-700",
      ring: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    },
  },
  PACKED: {
    label: "Packed",
    customerLabel: "Packed",
    description: "Your order has been packed.",
    tone: {
      pill: "bg-violet-100 text-violet-700",
      ring: "bg-violet-50 text-violet-700 ring-violet-200",
    },
  },
  READY_TO_SHIP: {
    label: "Ready to Ship",
    customerLabel: "Ready to Ship",
    description: "Waiting for courier pickup.",
    tone: {
      pill: "bg-purple-100 text-purple-700",
      ring: "bg-purple-50 text-purple-700 ring-purple-200",
    },
  },
  WAREHOUSE: {
    label: "Warehouse",
    customerLabel: "Warehouse Processing",
    description: "Received at the sorting center.",
    tone: {
      pill: "bg-cyan-100 text-cyan-700",
      ring: "bg-cyan-50 text-cyan-700 ring-cyan-200",
    },
  },
  IN_TRANSIT: {
    label: "In Transit",
    customerLabel: "In Transit",
    description: "On the move between facilities.",
    tone: {
      pill: "bg-blue-100 text-blue-700",
      ring: "bg-blue-50 text-blue-700 ring-blue-200",
    },
  },
  OUT_FOR_DELIVERY: {
    label: "Out for Delivery",
    customerLabel: "Out for Delivery",
    description: "Assigned to a delivery agent.",
    tone: {
      pill: "bg-teal-100 text-teal-700",
      ring: "bg-teal-50 text-teal-700 ring-teal-200",
    },
  },
  DELIVERED: {
    label: "Delivered",
    customerLabel: "Delivered",
    description: "Your order has been delivered.",
    tone: {
      pill: "bg-emerald-100 text-emerald-700",
      ring: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    },
  },
  CANCELLED: {
    label: "Cancelled",
    customerLabel: "Cancelled",
    description: "This order was cancelled.",
    tone: {
      pill: "bg-rose-100 text-rose-700",
      ring: "bg-rose-50 text-rose-700 ring-rose-200",
    },
  },
  RETURN_REQUESTED: {
    label: "Return Requested",
    customerLabel: "Return Requested",
    description: "A return has been requested.",
    tone: {
      pill: "bg-orange-100 text-orange-700",
      ring: "bg-orange-50 text-orange-700 ring-orange-200",
    },
  },
  RETURNED: {
    label: "Returned",
    customerLabel: "Returned",
    description: "The order was returned.",
    tone: {
      pill: "bg-stone-100 text-stone-700",
      ring: "bg-stone-50 text-stone-700 ring-stone-200",
    },
  },
  REFUNDED: {
    label: "Refunded",
    customerLabel: "Refunded",
    description: "Your refund has been completed.",
    tone: {
      pill: "bg-slate-100 text-slate-700",
      ring: "bg-slate-50 text-slate-700 ring-slate-200",
    },
  },
};

/** Type guard: is `value` one of the known statuses? */
export function isOrderStatus(value: unknown): value is OrderStatus {
  return (
    typeof value === "string" &&
    (ORDER_STATUSES as readonly string[]).includes(value)
  );
}

/** Is moving `from → to` an allowed transition? */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/** A status with no outgoing transitions (REFUNDED / CANCELLED). */
export function isTerminalStatus(status: OrderStatus): boolean {
  return STATUS_TRANSITIONS[status].length === 0;
}

/** Index of a status on the linear tracker rail, or -1 for branch states. */
export function trackingStepIndex(status: OrderStatus): number {
  return (ORDER_TRACKING_STEPS as readonly OrderStatus[]).indexOf(status);
}
