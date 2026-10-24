import type { Metadata } from "next";

import { AirwallexPaymentStatus } from "@/lib/airwallex/components/AirwallexPaymentStatus";
import { siteConfig } from "@/lib/seo/site";

type PaymentReturnPageProps = {
  searchParams: Promise<{ orderId?: string | string[] }>;
};

export const metadata: Metadata = {
  title: `Confirming payment | ${siteConfig.name}`,
  description: "Check the secure server-confirmed status of your payment.",
  robots: { index: false, follow: false },
};

export default async function PaymentReturnPage({
  searchParams,
}: PaymentReturnPageProps) {
  const { orderId: rawOrderId } = await searchParams;
  const orderId =
    typeof rawOrderId === "string" && rawOrderId.trim().length <= 255
      ? rawOrderId.trim() || null
      : null;

  return <AirwallexPaymentStatus orderId={orderId} />;
}
