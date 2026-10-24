import type { MetadataRoute } from "next";

import { absoluteUrl, siteConfig } from "@/lib/seo/site";

/**
 * Robots policy for SexToy.
 *
 * Public and noindex customer pages remain crawlable so robots can read
 * their page-level directives. Administrative and API surfaces stay blocked.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/dashboard",
        "/api/",
        "/*/admin",
        "/*/admin/",
        "/*/dashboard",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: siteConfig.url,
  };
}
