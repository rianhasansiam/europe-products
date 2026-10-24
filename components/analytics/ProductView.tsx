"use client";

import { useEffect } from "react";
import { useCurrency } from "@/components/currency/CurrencyProvider";
import { useSearchParams } from "next/navigation";
import { usePathname } from "@/lib/i18n/navigation";
import type { CommerceItem } from "@/lib/analytics/ecommerce";
import { getNavigationEventId, trackViewContent } from "@/lib/analytics/meta-pixel";

/** One parent-product view per navigation; option/quantity changes are not views. */
export default function ProductView({ item }: { item: CommerceItem }) {
  const { pricingReady } = useCurrency();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const route = query ? `${pathname}?${query}` : pathname;
  useEffect(() => {
    if (pricingReady === false) return;
    trackViewContent(item, getNavigationEventId(`view:${item.productId}`, route));
  }, [item, route, pricingReady]);
  return null;
}
