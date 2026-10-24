import LocaleSection from "@/components/i18n/LocaleSection";
import type { Metadata } from "next";

import { noIndexMetadata } from "@/lib/seo/metadata";
import { siteConfig } from "@/lib/seo/site";

/**
 * Checkout is a transactional client page for guests and account holders. This server
 * layout supplies a noindex robots tag so it's never indexed, matching
 * the robots.txt disallow rule.
 */
export const metadata: Metadata = noIndexMetadata(
  "Checkout",
  `Complete your ${siteConfig.name} order securely.`,
);
export const dynamic = "force-dynamic";

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <LocaleSection pathname="/checkout">{children}</LocaleSection>;
}
