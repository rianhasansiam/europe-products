import LocaleSection from "@/components/i18n/LocaleSection";
import type { Metadata } from "next";

import { noIndexMetadata } from "@/lib/seo/metadata";
import { getGoogleAuthCredentials } from "@/lib/auth/google";
import AuthProviderAvailability from "./_components/AuthProviderAvailability";

/**
 * Auth routes (login/register) are client components, so they can't
 * export metadata themselves. This server layout adds a noindex robots
 * tag as defense-in-depth alongside the robots.txt disallow rules.
 */
export const metadata: Metadata = noIndexMetadata("Account");
export const dynamic = "force-dynamic";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LocaleSection pathname="/login">
      <AuthProviderAvailability googleSignInAvailable={getGoogleAuthCredentials() !== null}>
        {children}
      </AuthProviderAvailability>
    </LocaleSection>
  );
}
