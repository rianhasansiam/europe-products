"use client";

import NextLink from "next/link";
import { usePathname as useNextPathname, useRouter as useNextRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { forwardRef, useMemo, type ComponentProps } from "react";
import { localizeHref, stripLocalePrefix } from "./paths";

type LinkProps = ComponentProps<typeof NextLink>;
export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function LocaleLink({ href, ...props }, ref) {
  const locale = useLocale();
  const localized = typeof href === "string" ? localizeHref(href, locale) : { ...href, pathname: href.pathname ? localizeHref(href.pathname, locale) : href.pathname };
  return <NextLink ref={ref} href={localized} {...props} />;
});
export default Link;

/** Existing active-menu and route checks keep using the original page pathname. */
export function usePathname(): string {
  return stripLocalePrefix(useNextPathname() ?? "/");
}

export function useRouter() {
  const router = useNextRouter();
  const locale = useLocale();
  return useMemo(() => ({
    ...router,
    push: (href: string, options?: Parameters<typeof router.push>[1]) => router.push(localizeHref(href, locale), options),
    replace: (href: string, options?: Parameters<typeof router.replace>[1]) => router.replace(localizeHref(href, locale), options),
    prefetch: (href: string, options?: Parameters<typeof router.prefetch>[1]) => router.prefetch(localizeHref(href, locale), options),
  }), [router, locale]);
}
