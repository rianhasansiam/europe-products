import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Users,
  FolderTree,
  BarChart3,
  Settings,
  Image as ImageIcon,
  Mail,
  ShieldCheck,
  Star,
  MessageSquareQuote,
  Wallet,
  Activity,
  Factory,
  Tags,
  ReceiptText,
} from "lucide-react";

/**
 * Static configuration shared across the admin shell.
 *
 * Anything dynamic (stats, orders, activity) is fetched at runtime by
 * the dashboard's React Server / client components — see
 * `lib/services/dashboard.service.ts` and `features/admin-dashboard`.
 */

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    label: "Main",
    items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Catalog",
    items: [
      { href: "/admin/products", label: "Products", icon: Package },
      { href: "/admin/categories", label: "Categories", icon: FolderTree },
      { href: "/admin/brands", label: "Brands", icon: Tags },
      {href: "/admin/manufacturers",label: "Manufacturers",icon: Factory }
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
      {href: "/admin/transactions",label: "Transactions",icon: ReceiptText},
      { href: "/admin/reviews", label: "Reviews", icon: Star },
      { href: "/admin/courier", label: "Courier Check", icon: ShieldCheck },
      { href: "/admin/users", label: "Customers", icon: Users },
      { href: "/admin/messages", label: "Messages", icon: Mail }
    ],
  },
  {
    label: "Content & Business",
    items: [
      { href: "/admin/banners", label: "Banners", icon: ImageIcon },
      {href: "/admin/testimonials",label: "Testimonials",icon: MessageSquareQuote},
      { href: "/admin/capital-costs", label: "Capital & Costs", icon: Wallet },
      { href: "/admin/activities", label: "Activity Log", icon: Activity },
      { href: "/admin/reports", label: "Reports", icon: BarChart3 },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

/** Flat compatibility export for code that needs to scan every route. */
export const ADMIN_NAV = ADMIN_NAV_GROUPS.flatMap((group) => group.items);
