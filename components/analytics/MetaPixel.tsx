"use client";

import { useSearchParams } from "next/navigation";
import { usePathname } from "@/lib/i18n/navigation";
import { useEffect } from "react";
import { initializeMetaPixel, trackPageView } from "@/lib/analytics/meta-pixel";

export default function MetaPixel({ pixelId }: { pixelId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const page = query ? `${pathname}?${query}` : pathname;

  useEffect(() => {
    if (initializeMetaPixel(pixelId)) trackPageView(page);
  }, [pixelId, page]);

  return null;
}
