import LocaleSection from "@/components/i18n/LocaleSection";
import type { Metadata } from "next";

import { noIndexMetadata } from "@/lib/seo/metadata";
import { siteConfig } from "@/lib/seo/site";

/**
 * The wishlist page is a client component. This server layout supplies a
 * noindex robots tag so the personal wishlist is never indexed, matching
 * the robots.txt disallow rule.
 */
export const metadata: Metadata = noIndexMetadata(
  "Your Wishlist",
  `Items you've saved to your ${siteConfig.name} wishlist.`,
);
export const dynamic = "force-dynamic";

export default function WishlistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <LocaleSection pathname="/wishlist">{children}</LocaleSection>;
}
