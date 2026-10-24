import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

/**
 * Parse UPLOAD_PUBLIC_URL at build/startup time so `next/image` can
 * optimise VPS-hosted uploads. Falls back gracefully when the env var
 * is not set (e.g. in CI).
 */
function uploadRemotePattern():
  | { protocol: "https"; hostname: string; port: string; pathname: string }
  | undefined {
  const raw = process.env.UPLOAD_PUBLIC_URL;
  if (!raw) return undefined;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:") return undefined;
    return {
      protocol: "https",
      hostname: parsed.hostname,
      port: "",
      pathname: `${parsed.pathname.replace(/\/+$/, "")}/**`,
    };
  } catch {
    return undefined;
  }
}

const nextConfig: NextConfig = {
  // Retain the request origin for internal locale rewrites. NextURL normalizes
  // 127.0.0.1 to localhost, which otherwise becomes an external self-request
  // when Next is bound to the loopback IP and causes locale redirect loops.
  skipProxyUrlNormalize: true,
  turbopack: {
    root: process.cwd(),
  },
  async rewrites() {
    if (process.env.NODE_ENV !== "development") return [];

    return {
      beforeFiles: [
        {
          source: "/_next/image",
          has: [
            {
              type: "query",
              key: "url",
              value: "https://i\\.ibb\\.co/.*",
            },
          ],
          // Legacy ImgBB images: reuse the storefront's resized cache in dev.
          destination: "https://sextoybd.com/_next/image",
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        port: "",
        pathname: "/a/**",
      },
      {
        protocol: "https",
        hostname: "placehold.co",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
        port: "",
        pathname: "/seed/**",
      },
      // Legacy ImgBB images — must remain for existing database records
      {
        protocol: "https",
        hostname: "i.ibb.co",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        port: "",
        pathname: "/photo-1542838132-92c53300491e",
      },
      // VPS-hosted uploads — added dynamically from UPLOAD_PUBLIC_URL
      ...(uploadRemotePattern() ? [uploadRemotePattern()!] : []),
    ],
  },
};

export default createNextIntlPlugin("./lib/i18n/request.ts")(nextConfig);
