import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveSiteUrl } from "@/lib/seo/site";
import { parseAirwallexEnvironment } from "@/lib/airwallex/config/airwallex.env";

const CANONICAL_ORIGIN = "https://sextoybd.net";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("permanent canonical domain", () => {
  it("uses the permanent origin when production has no URL override", () => {
    expect(resolveSiteUrl({ NODE_ENV: "production" })).toBe(CANONICAL_ORIGIN);
  });

  it("does not publish a development origin in production metadata", () => {
    expect(resolveSiteUrl({ NODE_ENV: "production", SITE_URL: "http://localhost:3000" })).toBe(CANONICAL_ORIGIN);
    expect(resolveSiteUrl({ NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3000" })).toBe(CANONICAL_ORIGIN);
  });

  it("keeps configured canonical and default payment return origins aligned", () => {
    expect(resolveSiteUrl({ NODE_ENV: "production", SITE_URL: `${CANONICAL_ORIGIN}/` })).toBe(CANONICAL_ORIGIN);
    const payment = parseAirwallexEnvironment({ NODE_ENV: "production" });
    expect(payment.returnUrl).toBe(`${CANONICAL_ORIGIN}/orders/payment-return`);
  });

  it("propagates the default origin into localized SEO, robots and organization data", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SITE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.resetModules();

    const [{ buildMetadata }, { organizationJsonLd }, { default: robots }] = await Promise.all([
      import("@/lib/seo/metadata"),
      import("@/lib/seo/json-ld"),
      import("@/app/robots"),
    ]);
    const metadata = buildMetadata({ title: "Contact", path: "/contact", locale: "en" });
    expect(metadata.alternates?.canonical).toBe(`${CANONICAL_ORIGIN}/en/contact`);
    expect(metadata.openGraph).toMatchObject({ url: `${CANONICAL_ORIGIN}/en/contact` });
    expect(robots()).toMatchObject({ host: CANONICAL_ORIGIN, sitemap: `${CANONICAL_ORIGIN}/sitemap.xml` });
    expect(organizationJsonLd()).toMatchObject({ url: CANONICAL_ORIGIN, logo: `${CANONICAL_ORIGIN}/logo/wordmark.svg` });
  });
});
