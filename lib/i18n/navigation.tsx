"use client";

import NextLink from "next/link";
import { usePathname as useNextPathname, useRouter as useNextRouter } from "next/navigation";
import { forwardRef, useMemo, type ComponentProps } from "react";
import { localizeHref, stripLocalePrefix } from "./paths";

type LinkProps = ComponentProps<typeof NextLink>;
export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function LocaleLink({ href, ...props }, ref) {
  const destination = typeof href === "string" ? localizeHref(href) : { ...href, pathname: href.pathname ? localizeHref(href.pathname) : href.pathname };
  return <NextLink ref={ref} href={destination} {...props} />;
});
export default Link;

/** Existing active-menu and route checks keep using the original page pathname. */
export function usePathname(): string {
  return stripLocalePrefix(useNextPathname() ?? "/");
}

export function useRouter() {
  const router = useNextRouter();
  return useMemo(() => ({
    ...router,
    push: (href: string, options?: Parameters<typeof router.push>[1]) => router.push(localizeHref(href), options),
    replace: (href: string, options?: Parameters<typeof router.replace>[1]) => router.replace(localizeHref(href), options),
    prefetch: (href: string, options?: Parameters<typeof router.prefetch>[1]) => router.prefetch(localizeHref(href), options),
  }), [router]);
}
