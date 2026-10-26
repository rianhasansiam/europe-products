"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import Link from "@/lib/i18n/navigation";
import { usePathname } from "@/lib/i18n/navigation";
import { signOut } from "next-auth/react";
import { Home, LogOut, ShieldCheck, X } from "lucide-react";
import { ADMIN_NAV_GROUPS } from "./data";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/lib/seo/site";
import { useLocale } from "next-intl";
import { localizeHref } from "@/lib/i18n/paths";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function AdminSidebar({ open, onClose }: Props) {
  const locale = useLocale();
  const i18n = useInterfaceTranslations("AdminAdminComponentsAdminSidebar");
  const pathname = usePathname();

  return (
    <>
      {/* Mobile backdrop */}
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-50 bg-gray-900/40 backdrop-blur-sm transition-opacity duration-300 lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <aside
        id="admin-sidebar"
        className={cn(
          "fixed inset-y-0 start-0 z-60 flex w-72 flex-col border-e border-brand-border bg-white shadow-xl transition-transform duration-300 ease-out lg:sticky lg:top-0 lg:z-0 lg:h-screen lg:translate-x-0 lg:shadow-sm",
          open ? "translate-x-0" : "-translate-x-full rtl:translate-x-full",
        )}
      >
        {/* Brand block */}
        <div className="flex items-center justify-between border-b border-brand-border bg-brand-black px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/30">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold text-white">{i18n("Admin Panel")}</p>
              <p className="text-[11px] font-medium text-white/70">{i18n(siteConfig.name)} {i18n("Console")}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={i18n("Close sidebar")}
            className="rounded-lg p-1.5 text-white/90 transition-colors duration-200 hover:bg-white/15 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-5">
            {ADMIN_NAV_GROUPS.map((group) => {
              const headingId = `nav-${group.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
              return (
              <section key={group.label} aria-labelledby={headingId}>
                <p
                  id={headingId}
                  className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-400"
                >
                  {i18n(group.label)}
                </p>
                <ul className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active =
                      item.href === "/admin"
                        ? pathname === "/admin"
                        : pathname.startsWith(item.href);

                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={onClose}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "group flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200",
                            active
                              ? "bg-brand-red text-brand-white shadow-sm"
                              : "text-brand-black hover:translate-x-0.5 hover:bg-brand-light-bg hover:text-brand-red",
                          )}
                        >
                          <span className="flex items-center gap-2.5">
                            <Icon
                              className={cn(
                                "h-4 w-4 transition-transform duration-200 group-hover:scale-110",
                                active ? "text-white" : "text-brand-red",
                              )}
                            />
                            {i18n(item.label)}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className="space-y-1 border-t border-brand-border p-3">
          <Link
            href="/"
            onClick={onClose}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-brand-black transition-all duration-200 hover:translate-x-0.5 hover:bg-brand-light-bg hover:text-brand-red"
          >
            <Home className="h-4 w-4 text-brand-red" />
            {i18n("Exit to Site")}</Link>
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: localizeHref("/", locale) })}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-600 transition-all duration-200 hover:translate-x-0.5 hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            {i18n("Sign Out")}</button>
        </div>
      </aside>
    </>
  );
}
