import LocaleSection from "@/components/i18n/LocaleSection";
import type { Metadata } from "next";

import { noIndexMetadata } from "@/lib/seo/metadata";

/**
 * The cart page is a client component. This server layout supplies a
 * noindex robots tag so the cart never gets indexed, matching the
 * robots.txt disallow rule.
 */
export const metadata: Metadata = noIndexMetadata(
  "Your Cart",
  "Review the items in your shopping cart before checkout.",
);
export const dynamic = "force-dynamic";

export default function CartLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <LocaleSection pathname="/cart">{children}</LocaleSection>;
}
