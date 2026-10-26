"use client";

import { usePathname } from "@/lib/i18n/navigation";

/**
 * Gates the public site chrome (top strip banner, navbar, footer) around
 * page content — but skips it entirely on the admin panel, which ships
 * its own sidebar/header shell.
 *
 * The chrome elements are created in the server layout and passed in as
 * props so their (server-only) module graph never leaks into this client
 * boundary; this component only decides whether to render them.
 */
export default function SiteChrome({
  banner,
  navbar,
  footer,
  children,
}: {
  banner: React.ReactNode;
  navbar: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin") ?? false;
  const hasMobileBottomActions =
    pathname === "/cart" || (pathname?.startsWith("/products/") ?? false);

  if (isAdmin) {
    return <>{children}</>;
  }

  return (
    <>
      {banner}
      {navbar}
      {children}
      {hasMobileBottomActions ? (
        <div className="bg-secondary pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0">
          {footer}
        </div>
      ) : (
        footer
      )}
    </>
  );
}
