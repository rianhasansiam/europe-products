import type { Metadata } from "next";
import { Suspense } from "react";

import ProfileClient from "./components/ProfileClient";
import { siteConfig } from "@/lib/seo/site";

export const metadata: Metadata = {
  title: `My Profile | ${siteConfig.name}`,
  description: `Manage your account, view orders, payment transactions, wishlist, and cart history on ${siteConfig.name}.`,
  robots: { index: false, follow: false },
};

/**
 * "My Profile" dashboard.
 *
 * Server wrapper only — every tab below this needs the live session
 * and Redux stores (cart, wishlist), so the bulk of the page is a
 * client component. `ProfileClient` reads `useSearchParams`, so it is
 * wrapped in Suspense to satisfy the CSR bailout requirement during
 * static prerendering.
 */
export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfileClient />
    </Suspense>
  );
}
