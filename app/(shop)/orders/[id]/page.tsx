import type { Metadata } from "next";

import OrderSummaryClient from "./components/OrderSummaryClient";
import { siteConfig } from "@/lib/seo/site";

type Props = {
  params: Promise<{ id: string }>;
};

export const metadata: Metadata = {
  title: `Order summary | ${siteConfig.name}`,
  description: "Review your order and download the receipt.",
  robots: { index: false, follow: false },
};

/**
 * Public order summary page.
 *
 * The page itself is a thin server wrapper that just unwraps the
 * `params` promise (Next 16 convention) and hands the id to the
 * client component. All data fetching happens client-side because
 * account owners and guests call `/api/orders/[id]` directly. That endpoint
 * enforces account ownership or the scoped guest-order access cookie.
 */
export default async function OrderSummaryPage({ params }: Props) {
  const { id } = await params;
  return <OrderSummaryClient key={id} orderId={id} />;
}
