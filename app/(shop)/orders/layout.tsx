import LocaleSection from "@/components/i18n/LocaleSection";
import type { Metadata } from "next";

import { noIndexMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = noIndexMetadata(
  "Orders",
  "Review your private order details and receipts.",
);
export const dynamic = "force-dynamic";

export default function OrdersLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <LocaleSection pathname="/orders">{children}</LocaleSection>;
}
