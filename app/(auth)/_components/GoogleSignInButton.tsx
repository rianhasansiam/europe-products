"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { useState } from "react";
import { signIn } from "next-auth/react";
import { useLocale } from "next-intl";
import { localizeHref } from "@/lib/i18n/paths";

import GoogleIcon from "./GoogleIcon";
import { LoadingSpinner } from "@/components/ui/loading";
import { useGoogleSignInAvailable } from "./AuthProviderAvailability";

type GoogleSignInButtonProps = {
  /**
   * Where NextAuth should send the user after the OAuth round-trip succeeds.
   * Defaults to the home page; pass the desired path explicitly when the
   * caller knows where the user came from (e.g. login reads `?callbackUrl=`).
   */
  callbackUrl?: string;
};

export function SocialDivider() {
  const i18n = useInterfaceTranslations("InterfaceComponentsGoogleSignInButton");
  const googleSignInAvailable = useGoogleSignInAvailable();
  if (!googleSignInAvailable) return null;
  return (
    <div className="my-1 flex items-center gap-3">
      <div className="h-px flex-1 bg-linear-to-r from-transparent via-border to-border" />

      <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {i18n("or continue with")}</span>

      <div className="h-px flex-1 bg-linear-to-l from-transparent via-border to-border" />
    </div>
  );
}

export function GoogleSignInButton({
  callbackUrl = "/",
}: GoogleSignInButtonProps = {}) {
  const i18n = useInterfaceTranslations("InterfaceComponentsGoogleSignInButton");
  const [isRedirecting, setIsRedirecting] = useState(false);
  const locale = useLocale();
  const googleSignInAvailable = useGoogleSignInAvailable();
  if (!googleSignInAvailable) return null;

  const handleClick = () => {
    if (isRedirecting) return;
    setIsRedirecting(true);
    // Full-page redirect to Google's consent screen. NextAuth will return
    // to `callbackUrl` after the round-trip succeeds.
    void signIn("google", { callbackUrl: localizeHref(callbackUrl, locale) });
  };

  return (
    <div className="grid grid-cols-1 gap-2.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={isRedirecting}
        aria-busy={isRedirecting}
        className="group flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-bold text-foreground transition-colors duration-200 hover:border-primary hover:bg-primary/5 hover:text-primary disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
      >
        <span className="transition-transform duration-300 ">
          {isRedirecting ? (
            <LoadingSpinner decorative size="sm" />
          ) : (
            <GoogleIcon />
          )}
        </span>

        <span>{isRedirecting ? i18n("Redirecting...") : i18n("Continue with Google")}</span>
      </button>
    </div>
  );
}
