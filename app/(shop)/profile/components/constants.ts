import {
  Heart,
  KeyRound,
  LayoutDashboard,
  Package,
  ReceiptText,
  ShoppingBag,
  UserCog,
  type LucideIcon,
} from "lucide-react";

import type { OrderStatus } from "@/features/orders/api";
import { ORDER_STATUS_META } from "@/lib/orders/status";

/**
 * Tab definitions for the My Profile dashboard.
 *
 * The order here is the order rendered in the side rail. `id`s are
 * URL hash slugs so the app can deep-link to any tab.
 */
export type ProfileTabId =
  | "overview"
  | "orders"
  | "transactions"
  | "wishlist"
  | "cart"
  | "settings"
  | "security";

export type ProfileTab = {
  id: ProfileTabId;
  label: string;
  description: string;
  icon: LucideIcon;
};

export const PROFILE_TABS: readonly ProfileTab[] = [
  {
    id: "overview",
    label: "Overview",
    description: "Account at a glance.",
    icon: LayoutDashboard,
  },
  {
    id: "orders",
    label: "Orders",
    description: "Track and re-order purchases.",
    icon: Package,
  },
  {
    id: "transactions",
    label: "Transactions",
    description: "Review your payment history.",
    icon: ReceiptText,
  },
  {
    id: "wishlist",
    label: "Wishlist",
    description: "Saved for later.",
    icon: Heart,
  },
  {
    id: "cart",
    label: "Cart",
    description: "Items waiting to check out.",
    icon: ShoppingBag,
  },
  {
    id: "settings",
    label: "Settings",
    description: "Edit your personal info.",
    icon: UserCog,
  },
  {
    id: "security",
    label: "Security",
    description: "Password and sign-in.",
    icon: KeyRound,
  },
];

export const ORDER_STATUS_TONE: Record<
  OrderStatus,
  { label: string; pill: string }
> = Object.fromEntries(
  (Object.entries(ORDER_STATUS_META) as [OrderStatus, (typeof ORDER_STATUS_META)[OrderStatus]][]).map(
    ([status, meta]) => [status, { label: meta.label, pill: meta.tone.pill }],
  ),
) as Record<OrderStatus, { label: string; pill: string }>;

export const FALLBACK_PRODUCT_IMAGE =
  "https://images.unsplash.com/photo-1542838132-92c53300491e?w=400";
