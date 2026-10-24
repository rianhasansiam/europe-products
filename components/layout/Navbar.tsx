"use client";

import {
  Menu,
  User,
  ShoppingCart,
  Heart,
  Mail,
  Shield,
  Store,
  Info,
  LogIn,
  UserPlus,
  LogOut,
  ChevronDown,
  X,
} from "lucide-react";
import Link, { usePathname } from "@/lib/i18n/navigation";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import LanguageSelector, { type SelectableLanguage } from "@/components/i18n/LanguageSelector";
import { localizeHref } from "@/lib/i18n/paths";
import { getLocaleDefinition } from "@/lib/i18n/registry";
import { signOut } from "next-auth/react";
import { useSession } from "@/lib/auth/use-app-session";
import { useSelector } from "react-redux";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import SearchBar from "@/components/layout/SearchBar";
import {
  DesktopCategoryMenu,
  MobileCategoryMenu,
} from "@/components/layout/CategoryNavigation";
import type { PublicCategoryNode } from "@/features/categories/api";
import { confirm } from "@/lib/feedback";
import { siteConfig } from "@/lib/seo/site";
import type { RootState } from "@/store";

type MenuItem = {
  href: string;
  label: string;
  icon: typeof Store;
  adminOnly?: boolean;
};

const MENU_ITEMS: readonly MenuItem[] = [
  { href: "/products", label: "allProducts", icon: Store },
  { href: "/about", label: "about", icon: Info },
  { href: "/contact", label: "contact", icon: Mail },
  { href: "/admin", label: "admin", icon: Shield, adminOnly: true },
] as const;

/** Grace period (ms) so the cursor can travel from trigger to dropdown content. */
const HOVER_CLOSE_DELAY_MS = 120;

export default function Navbar({
  categories = [],
  languages = [],
  initialMobileMenuOpen = false,
}: {
  categories?: PublicCategoryNode[];
  languages?: SelectableLanguage[];
  /** Explicit initial presentation for SSR previews; visitor navigation starts closed. */
  initialMobileMenuOpen?: boolean;
}) {
  const t = useTranslations("Navigation");
  const locale = useLocale();
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user ?? null;
  const isAdmin = user?.role === "ADMIN";

  // Badge counts from Redux store
  const cartCount = useSelector((state: RootState) =>
    state.cart.items.reduce((sum, item) => sum + item.quantity, 0),
  );
  const wishlistCount = useSelector(
    (state: RootState) => state.wishlist.items.length,
  );

  const visibleMenuItems = MENU_ITEMS.filter(
    (item) => !item.adminOnly || isAdmin,
  );
  const recommendedSearches = categories
    .filter((category) => category.totalProductCount > 0)
    .slice(0, 6)
    .map((category) => category.name);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(initialMobileMenuOpen);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const mobileMenuPanelRef = useRef<HTMLElement | null>(null);
  const mobileMenuCloseRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const desktopQuery = window.matchMedia("(min-width: 1280px)");

    const focusFrame = requestAnimationFrame(() => {
      mobileMenuCloseRef.current?.focus({ preventScroll: true });
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (
        !mobileMenuPanelRef.current?.contains(event.target as Node) &&
        !mobileMenuButtonRef.current?.contains(event.target as Node)
      ) return;

      setMobileMenuOpen(false);
      mobileMenuButtonRef.current?.focus({ preventScroll: true });
    };

    const handleDesktopChange = (event: MediaQueryListEvent) => {
      if (event.matches) setMobileMenuOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    desktopQuery.addEventListener("change", handleDesktopChange);

    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      desktopQuery.removeEventListener("change", handleDesktopChange);
    };
  }, [mobileMenuOpen]);

  const cancelClose = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimerRef.current = setTimeout(() => {
      setProfileMenuOpen(false);
      closeTimerRef.current = null;
    }, HOVER_CLOSE_DELAY_MS);
  };

  const openProfileMenu = () => {
    cancelClose();
    setProfileMenuOpen(true);
  };

  const handleLogout = async () => {
    const ok = await confirm({
      title: t("signOutTitle"),
      description: t("signOutDescription"),
      confirmLabel: t("signOut"),
      cancelLabel: t("stay"),
      variant: "warning",
    });
    if (!ok) return;
    setProfileMenuOpen(false);
    setMobileMenuOpen(false);
    void signOut({ callbackUrl: localizeHref("/", locale) });
  };

  return (
    <header className="sticky top-0 z-50 bg-brand-light-bg px-1 py-2 sm:px-4 lg:border-b lg:border-brand-border lg:px-0 lg:py-0">
      <div className="relative mx-auto flex w-full min-w-0 max-w-7xl items-center justify-between gap-2 rounded-md border border-brand-border bg-brand-white py-2.5 shadow-sm sm:px-4 lg:rounded-none lg:border-none lg:bg-transparent lg:px-6 lg:py-3 lg:shadow-none">
        {/* LEFT: Mobile Menu + Brand */}
        <div className="flex min-w-0 items-center gap-2">
          <button
            ref={mobileMenuButtonRef}
            type="button"
            onClick={() => {
              setMobileMenuOpen((open) => !open);
            }}
            aria-label={mobileMenuOpen ? t("closeMenu") : t("openMenu")}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation-drawer"
            className="shrink-0 rounded-full p-2 text-brand-black transition-colors duration-200 hover:bg-brand-white/40 hover:text-brand-red xl:hidden"
          >
            <Menu className="h-6 w-6" />
          </button>

          <Link
            href="/"
            aria-label={t("homeLabel", { brand: siteConfig.name })}
            className="group flex min-w-0 shrink-0 items-center rounded-xl px-1 py-1.5 transition-transform duration-300 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2"
          >
            <div
              aria-hidden="true"
              className="flex min-w-0 select-none flex-col items-center"
            >
              <span className="whitespace-nowrap text-xl font-black leading-none tracking-[-0.055em] text-brand-black sm:text-2xl">
                Sex<span className="text-brand-red">Toy</span>
              </span>
              <span className="mt-1 whitespace-nowrap text-[0.46rem] font-bold uppercase leading-none tracking-[0.15em] text-brand-text-muted transition-colors duration-300 group-hover:text-brand-black max-[374px]:hidden sm:text-[0.5rem] sm:tracking-[0.18em]">
               {t("tagline")}
              </span>
            </div>
          </Link>
        </div>

        {/* DESKTOP MENU */}
        <nav className="hidden items-center gap-2 xl:flex">
          <DesktopCategoryMenu
            categories={categories}
            active={pathname === "/categories" || pathname.startsWith("/categories/")}
          />
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red focus-visible:text-brand-red",
                  active
                    ? "text-brand-red"
                    : "text-brand-black hover:text-brand-red",
                )}
              >
                <Icon className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" />
                {t(item.label)}
                <span
                  className={cn(
                    "absolute bottom-0 left-1/2 h-0.5 w-[60%] -translate-x-1/2 rounded-full bg-brand-red transition-all duration-200 ease-out",
                    active
                      ? "scale-x-100 opacity-100"
                      : "scale-x-0 opacity-0",
                  )}
                />
              </Link>
            );
          })}
        </nav>

        {/* DESKTOP SEARCH */}
        <SearchBar
          className="mx-4 hidden max-w-lg flex-1 md:block"
          placeholder={t("searchProducts")}
          recommendations={recommendedSearches}
        />

        {/* RIGHT ICONS */}
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          <LanguageSelector languages={languages} />
          {!user && (
            <Link
              href="/login"
              aria-label={t("signIn")}
              className="flex h-10 w-10 items-center justify-center gap-1 p-0 text-sm font-semibold text-brand-black transition-colors duration-200 hover:text-brand-red sm:h-auto sm:w-auto sm:px-2 sm:py-1.5 xl:hidden"
            >
              <span className="hidden sm:inline">{t("signIn")}</span>
              <User className="h-5 w-5" />
            </Link>
          )}

          {user && (
            <Link
              href="/profile"
              className="flex h-10 w-10 items-center justify-center rounded-full p-0 transition-colors duration-200 hover:bg-brand-white/40 xl:hidden"
              aria-label={t("myProfile")}
            >
              <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full border-2 border-brand-border bg-brand-light-bg">
                {user.image ? (
                  <Image
                    src={user.image}
                    alt={user.name || t("user")}
                    width={24}
                    height={24}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User className="h-3.5 w-3.5 text-brand-black" />
                )}
              </div>
            </Link>
          )}

          <Link
            href="/wishlist"
            aria-label={wishlistCount > 0 ? t("wishlistItems", { count: wishlistCount }) : t("wishlist")}
            className="group relative flex h-10 w-10 items-center justify-center rounded-full p-0 transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-white/40 xl:h-auto xl:w-auto xl:p-2"
          >
            <Heart className="h-5 w-5 text-brand-black transition-transform duration-200 group-hover:scale-110 group-hover:text-brand-red" />
            {wishlistCount > 0 && (
              <span className="absolute end-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-red px-1 text-[10px] font-bold leading-none text-brand-white ring-2 ring-brand-white xl:end-0.5 xl:top-0.5">
                {wishlistCount > 99 ? "99+" : wishlistCount}
              </span>
            )}
          </Link>

          <Link
            href="/cart"
            aria-label={cartCount > 0 ? t("cartItems", { count: cartCount }) : t("cart")}
            className="group relative flex h-10 w-10 items-center justify-center rounded-full p-0 transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-white/40 xl:h-auto xl:w-auto xl:p-2"
          >
            <ShoppingCart className="h-5 w-5 text-brand-black transition-transform duration-200 group-hover:scale-110 group-hover:text-brand-red" />
            {cartCount > 0 && (
              <span className="absolute end-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-red px-1 text-[10px] font-bold leading-none text-brand-white ring-2 ring-brand-white xl:end-0.5 xl:top-0.5">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </Link>

          {/* DESKTOP: PROFILE / AUTH */}
          <div className="relative hidden xl:block">
            {user ? (
              <DropdownMenu
                dir={getLocaleDefinition(locale).direction}
                modal={false}
                open={profileMenuOpen}
                onOpenChange={setProfileMenuOpen}
              >
                <div
                  onMouseEnter={openProfileMenu}
                  onMouseLeave={scheduleClose}
                >
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      onPointerDown={(event) => {
                        // When the menu is already open (e.g. via hover), the
                        // trigger's pointerdown would toggle it closed and
                        // leave it stuck — the cursor is still on the button
                        // so no fresh mouseenter fires to reopen it. Block
                        // Radix's toggle in that case; the menu still closes
                        // via mouseleave, outside-click, or Escape.
                        if (profileMenuOpen) {
                          event.preventDefault();
                        }
                      }}
                      className="group flex items-center gap-2 rounded-full p-1.5 transition-colors duration-200 hover:bg-brand-white/40"
                      aria-label={t("openProfileMenu")}
                    >
                      <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border-2 border-brand-border bg-brand-light-bg transition-transform duration-300 group-hover:scale-105">
                        {user.image ? (
                          <Image
                            src={user.image}
                            alt={user.name || t("user")}
                            width={32}
                            height={32}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <User className="h-4 w-4 text-brand-black" />
                        )}
                      </div>
                      <ChevronDown className="h-4 w-4 text-brand-black transition-transform duration-300 group-data-[state=open]:rotate-180" />
                    </button>
                  </DropdownMenuTrigger>
                </div>

                <DropdownMenuContent
                  align="end"
                  className="w-64 p-0"
                  onMouseEnter={cancelClose}
                  onMouseLeave={scheduleClose}
                >
                  <div className="border-b border-brand-border bg-brand-light-bg p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2 border-brand-border bg-brand-light-bg">
                        {user.image ? (
                          <Image
                            src={user.image}
                            alt={user.name || t("user")}
                            width={48}
                            height={48}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <User className="h-6 w-6 text-brand-black" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-brand-black">
                          {user.name || t("user")}
                        </p>
                        {user.email && (
                          <p className="truncate text-xs text-brand-text-muted">
                            {user.email}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="p-1.5">
                    <DropdownMenuItem asChild>
                      <Link href="/profile">
                        <User className="h-4 w-4" />
                        {t("myProfile")}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>

                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/wishlist">
                        <Heart className="h-4 w-4" />
                        {t("wishlist")}
                      </Link>
                    </DropdownMenuItem>
                  </div>
                  <DropdownMenuSeparator className="my-0" />
                  <div className="p-1.5">
                    <DropdownMenuItem
                      onSelect={(event) => {
                        event.preventDefault();
                        void handleLogout();
                      }}
                      className="text-red-600 focus:bg-red-50 focus:text-red-700"
                    >
                      <LogOut className="h-4 w-4" />
                      {t("signOut")}
                    </DropdownMenuItem>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="hidden items-center gap-2 sm:flex">
                <Link
                  href="/login"
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-brand-black transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-white/40 hover:text-brand-red"
                >
                  <LogIn className="h-4 w-4" />
                  {t("signIn")}
                </Link>
                <Link
                  href="/register"
                  className="flex items-center gap-1.5 rounded-lg bg-brand-red px-3 py-2 text-sm font-medium text-brand-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-red-hover hover:shadow-md"
                >
                  <UserPlus className="h-4 w-4" />
                  {t("signUp")}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Persistent mobile search keeps catalog discovery visible without an extra tap. */}
      <div className="mx-auto w-full max-w-7xl px-1 pt-2 md:hidden sm:px-0">
        <SearchBar
          placeholder={t("searchProducts")}
          recommendations={recommendedSearches}
          inputClassName="h-11 border-2 border-brand-red/35 bg-brand-white ps-10 text-[16px] shadow-sm focus-visible:border-brand-red"
        />
      </div>

      {/* Non-modal mobile menu keeps the visible page clickable and scrollable. */}
      <aside
        id="mobile-navigation-drawer"
        ref={mobileMenuPanelRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby="mobile-navigation-title"
        aria-describedby="mobile-navigation-description"
        aria-hidden={!mobileMenuOpen}
        inert={!mobileMenuOpen}
        className={cn(
          "fixed inset-y-0 start-0 z-70 flex h-dvh w-[85%] max-w-sm transform-gpu flex-col overflow-hidden border-e border-brand-border bg-brand-light-bg shadow-xl [backface-visibility:hidden] [contain:paint] transition-transform duration-[420ms] ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform motion-reduce:transition-none xl:hidden",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full rtl:translate-x-full",
        )}
      >
        <div className="relative bg-brand-black px-4 py-3 text-brand-white">
          <h2
            id="mobile-navigation-title"
              className="pe-10 text-base font-bold text-brand-white"
          >
            {t("menu")}
          </h2>
          <p id="mobile-navigation-description" className="sr-only">
            {t("menuDescription")}
          </p>
          <button
            ref={mobileMenuCloseRef}
            type="button"
            aria-label={t("closeMenu")}
            onClick={() => {
              setMobileMenuOpen(false);
              mobileMenuButtonRef.current?.focus({ preventScroll: true });
            }}
            className="absolute end-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-brand-white/90 transition-colors duration-150 hover:bg-brand-white/15 focus:outline-none focus:ring-2 focus:ring-brand-white/40"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mobile Search */}
        <div className="border-b border-brand-border bg-brand-white/40 px-4 py-3">
          <SearchBar
            placeholder={t("search")}
            recommendations={recommendedSearches}
            inputClassName="rounded-xl border-brand-border bg-brand-white"
            onNavigate={() => setMobileMenuOpen(false)}
          />
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <LanguageSelector languages={languages} mobile />
          <MobileCategoryMenu
            categories={categories}
            onNavigate={() => setMobileMenuOpen(false)}
          />
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-3 text-base font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red",
                  active
                    ? "bg-brand-red text-brand-white shadow-md"
                    : "text-brand-black hover:translate-x-1 rtl:hover:-translate-x-1 hover:bg-brand-white/60 hover:text-brand-red",
                )}
              >
                <Icon className="h-5 w-5" />
                {t(item.label)}
              </Link>
            );
          })}

          <div className="mt-2 border-t border-brand-border pt-2">
            {user ? (
              <>
                <Link
                  href="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-base font-semibold text-brand-black transition-all duration-200 hover:translate-x-1 rtl:hover:-translate-x-1 hover:bg-brand-white/60 hover:text-brand-red"
                >
                  <User className="h-5 w-5" />
                  {t("myProfile")}
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    void handleLogout();
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-base font-semibold text-red-600 transition-all duration-200 hover:translate-x-1 rtl:hover:-translate-x-1 hover:bg-red-50"
                >
                  <LogOut className="h-5 w-5" />
                  {t("signOut")}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-base font-semibold text-brand-black transition-all duration-200 hover:translate-x-1 rtl:hover:-translate-x-1 hover:bg-brand-white/60 hover:text-brand-red"
                >
                  <LogIn className="h-5 w-5" />
                  {t("signIn")}
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 rounded-xl bg-brand-red px-4 py-3 text-base font-semibold text-brand-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-red-hover"
                >
                  <UserPlus className="h-5 w-5" />
                  {t("signUp")}
                </Link>
              </>
            )}
          </div>
        </nav>
      </aside>
    </header>
  );
}
