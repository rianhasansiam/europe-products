"use client";
import { useLocale } from "next-intl";

import { useInterfaceTranslations } from "@/components/i18n/translate";


/* eslint-disable @next/next/no-img-element */

import { AnimatePresence, motion } from "framer-motion";
import Link from "@/lib/i18n/navigation";

import {
  categoryBannerHref,
  formatDate,
  type CarouselBannerRow,
  type CategoryBannerRow,
  type DealBannerRow,
  type PromoBannerRow,
  type TopBannerRow,
} from "@/features/admin-banners/api";
import {
  resolveBannerBackground,
  resolveColorValue,
} from "@/components/ui/tailwind-palette";
import {
  LIST_ITEM_TRANSITION,
  LIST_ITEM_VARIANTS,
} from "@/lib/motion/list-removal";
import { cn } from "@/lib/utils";

import { EmptyState, RowFooter } from "./RowFooter";
import { STATUS_BADGE } from "./constants";

export function CarouselList({
  rows,
  busyId,
  onEdit,
  onDelete,
}: {
  rows: CarouselBannerRow[];
  busyId: string | null;
  onEdit: (banner: CarouselBannerRow) => void;
  onDelete: (banner: CarouselBannerRow) => void;
}) {
  const i18n = useInterfaceTranslations("AdminAdminBannersComponentsBannerLists");
  if (rows.length === 0) return <EmptyState label={i18n("No carousel slides yet.")} />;

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <AnimatePresence initial={false} mode="popLayout">
        {rows.map((banner) => (
        <motion.article
          key={banner.id}
          layout
          initial="initial"
          animate="animate"
          exit="exit"
          variants={LIST_ITEM_VARIANTS}
          transition={LIST_ITEM_TRANSITION}
          className="overflow-hidden rounded-2xl border border-brand-border bg-brand-white shadow-sm"
        >
          <div className="relative h-32 w-full overflow-hidden bg-gray-100">
            <img
              src={banner.image}
              alt={banner.title}
              className="h-full w-full object-cover"
            />
            <span
              className={cn(
                "absolute right-2 top-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset",
                STATUS_BADGE[banner.status],
              )}
            >
              {banner.status}
            </span>
          </div>
          <div className="space-y-2 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-text-muted">
                  {banner.badge}
                </p>
                <h3 className="truncate text-base font-bold text-gray-900">
                  {banner.title}{" "}
                  <span className="font-medium text-gray-500">
                    · {banner.subtitle}
                  </span>
                </h3>
              </div>
              <span className="rounded-lg bg-brand-light-bg px-2 py-1 text-xs font-semibold text-foreground">
                #{banner.position}
              </span>
            </div>
            <p className="line-clamp-2 text-xs text-gray-500">
              {banner.description}
            </p>
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
              <span
                aria-hidden
                className="h-3.5 w-3.5 shrink-0 rounded ring-1 ring-inset ring-black/10"
                style={{
                  background: resolveBannerBackground({
                    bgType: banner.bgType,
                    bgColor: banner.bgColor,
                    bgFrom: banner.bgFrom,
                    bgVia: banner.bgVia,
                    bgTo: banner.bgTo,
                  }),
                }}
              />
              <span className="truncate font-mono">
                {banner.bgType === "solid"
                  ? banner.bgColor
                  : `${banner.bgFrom ?? ""}${
                      banner.bgVia ? ` → ${banner.bgVia}` : ""
                    } → ${banner.bgTo ?? ""}`}
              </span>
              {banner.link && (
                <span className="ms-1 truncate font-mono">→ {banner.link}</span>
              )}
            </div>
            <RowFooter
              busyId={busyId}
              banner={banner}
              onEdit={() => onEdit(banner)}
              onDelete={() => onDelete(banner)}
            />
          </div>
        </motion.article>
      ))}
      </AnimatePresence>
    </div>
  );
}

export function CategoryList({
  rows,
  busyId,
  onEdit,
  onDelete,
}: {
  rows: CategoryBannerRow[];
  busyId: string | null;
  onEdit: (banner: CategoryBannerRow) => void;
  onDelete: (banner: CategoryBannerRow) => void;
}) {
  const i18n = useInterfaceTranslations("AdminAdminBannersComponentsBannerLists");
  if (rows.length === 0) return <EmptyState label={i18n("No category banners yet.")} />;

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <AnimatePresence initial={false} mode="popLayout">
        {rows.map((banner) => (
        <motion.article
          key={banner.id}
          layout
          initial="initial"
          animate="animate"
          exit="exit"
          variants={LIST_ITEM_VARIANTS}
          transition={LIST_ITEM_TRANSITION}
          className="overflow-hidden rounded-2xl border border-brand-border bg-brand-white shadow-sm"
        >
          <div className="relative h-32 w-full overflow-hidden bg-gray-100">
            <img
              src={banner.image}
              alt={banner.heading}
              className="h-full w-full object-cover"
            />
            <span
              className={cn(
                "absolute right-2 top-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset",
                STATUS_BADGE[banner.status],
              )}
            >
              {banner.status}
            </span>
          </div>
          <div className="space-y-2 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-red">
                  {banner.label}
                </p>
                <h3 className="truncate text-base font-bold text-gray-900">
                  {banner.heading}
                </h3>
              </div>
              <span className="rounded-lg bg-brand-red/10 px-2 py-1 text-xs font-bold text-brand-red">
                {banner.discount}
              </span>
            </div>
            <p className="line-clamp-2 text-xs text-gray-500">
              {banner.description}
            </p>
            <div className="text-[11px] text-gray-500">
              <p>
                {i18n("Linked to:")}{" "}
                <span className="font-semibold text-brand-black">
                  {banner.category.name || banner.categoryId}
                </span>
              </p>
              <p className="mt-0.5 truncate font-mono text-gray-400">
                /{banner.category.path}
              </p>
              <Link
                href={
                  banner.link ?? categoryBannerHref(banner.category.path)
                }
                className="mt-1 inline-flex max-w-full items-center gap-1 truncate font-mono font-semibold text-brand-red hover:underline"
              >
                {i18n("Storefront →")}{" "}
                {banner.link ?? categoryBannerHref(banner.category.path)}
              </Link>
            </div>
            <RowFooter
              busyId={busyId}
              banner={banner}
              onEdit={() => onEdit(banner)}
              onDelete={() => onDelete(banner)}
            />
          </div>
        </motion.article>
      ))}
      </AnimatePresence>
    </div>
  );
}

export function TopList({
  rows,
  busyId,
  onEdit,
  onDelete,
}: {
  rows: TopBannerRow[];
  busyId: string | null;
  onEdit: (banner: TopBannerRow) => void;
  onDelete: (banner: TopBannerRow) => void;
}) {
  const locale = useLocale();
  const i18n = useInterfaceTranslations("AdminAdminBannersComponentsBannerLists");
  if (rows.length === 0) return <EmptyState label={i18n("No top strip slides yet.")} />;

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <AnimatePresence initial={false} mode="popLayout">
        {rows.map((banner) => (
        <motion.article
          key={banner.id}
          layout
          initial="initial"
          animate="animate"
          exit="exit"
          variants={LIST_ITEM_VARIANTS}
          transition={LIST_ITEM_TRANSITION}
          className="overflow-hidden rounded-2xl border border-brand-border bg-brand-white shadow-sm"
        >
          <div className="relative bg-brand-black px-4 py-3 text-white">
            <span
              className={cn(
                "absolute right-2 top-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset",
                STATUS_BADGE[banner.status],
              )}
            >
              {banner.status}
            </span>
            <p className="text-xs font-semibold uppercase tracking-wide">
              {banner.icon} · {banner.badge}
            </p>
            <p className="text-sm">
              <span className="text-brand-red font-extrabold">
                {banner.discount}
              </span>{" "}
              {banner.description}
            </p>
            <p className="text-[11px] opacity-90">
              {banner.tagIcon} · {banner.tag}
            </p>
            {banner.link && (
              <p className="truncate text-[11px] font-mono opacity-90">
                {banner.link}
              </p>
            )}
          </div>
          <div className="space-y-2 p-4">
            <p className="text-[11px] text-gray-400">
              {i18n("Position")}{" "}
              <span className="font-semibold text-brand-black">
                #{banner.position}
              </span>
              <span className="mx-2">·</span>
              {i18n("Created")}{" "}{formatDate(banner.createdAt, locale)}
            </p>
            <RowFooter
              busyId={busyId}
              banner={banner}
              onEdit={() => onEdit(banner)}
              onDelete={() => onDelete(banner)}
            />
          </div>
        </motion.article>
      ))}
      </AnimatePresence>
    </div>
  );
}

export function DealList({
  rows,
  busyId,
  onEdit,
  onDelete,
}: {
  rows: DealBannerRow[];
  busyId: string | null;
  onEdit: (banner: DealBannerRow) => void;
  onDelete: (banner: DealBannerRow) => void;
}) {
  const i18n = useInterfaceTranslations("AdminAdminBannersComponentsBannerLists");
  if (rows.length === 0) return <EmptyState label={i18n("No deal banners yet.")} />;

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <AnimatePresence initial={false} mode="popLayout">
        {rows.map((banner) => (
        <motion.article
          key={banner.id}
          layout
          initial="initial"
          animate="animate"
          exit="exit"
          variants={LIST_ITEM_VARIANTS}
          transition={LIST_ITEM_TRANSITION}
          className="overflow-hidden rounded-2xl border border-brand-border bg-brand-white shadow-sm"
        >
          <div
            className="relative h-28 overflow-hidden"
            style={{ backgroundColor: resolveColorValue(banner.bgClass) ?? "#f43f5e" }}
          >
            <img
              src={banner.image}
              alt={banner.title}
              className="h-full w-full object-cover opacity-60"
            />
            <span
              className={cn(
                "absolute right-2 top-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset",
                STATUS_BADGE[banner.status],
              )}
            >
              {banner.status}
            </span>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white">
              <p className="text-xs font-semibold opacity-90">
                {banner.subtitle}
              </p>
              <h3 className="text-lg font-black drop-shadow">{banner.title}</h3>
            </div>
          </div>
          <div className="space-y-2 p-3">
            <p className="text-[11px] text-gray-400">
              <span className="font-mono">{banner.bgClass}</span>
              <span className="mx-2">·</span>
              {i18n("Position")}{" "}{banner.position}
            </p>
            {banner.link && (
              <p className="truncate text-[11px] text-gray-400">
                <span className="font-mono">→ {banner.link}</span>
              </p>
            )}
            <RowFooter
              busyId={busyId}
              banner={banner}
              onEdit={() => onEdit(banner)}
              onDelete={() => onDelete(banner)}
            />
          </div>
        </motion.article>
      ))}
      </AnimatePresence>
    </div>
  );
}

export function PromoList({
  rows,
  busyId,
  onEdit,
  onDelete,
}: {
  rows: PromoBannerRow[];
  busyId: string | null;
  onEdit: (banner: PromoBannerRow) => void;
  onDelete: (banner: PromoBannerRow) => void;
}) {
  const i18n = useInterfaceTranslations("AdminAdminBannersComponentsBannerLists");
  if (rows.length === 0) return <EmptyState label={i18n("No promo banners yet.")} />;

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <AnimatePresence initial={false} mode="popLayout">
        {rows.map((banner) => (
        <motion.article
          key={banner.id}
          layout
          initial="initial"
          animate="animate"
          exit="exit"
          variants={LIST_ITEM_VARIANTS}
          transition={LIST_ITEM_TRANSITION}
          className="overflow-hidden rounded-2xl border border-brand-border bg-brand-white shadow-sm"
        >
          <div
            className="relative h-44 overflow-hidden"
            style={{ backgroundColor: resolveColorValue(banner.bgClass) ?? "#6d28d9" }}
          >
            <img
              src={banner.image}
              alt={banner.title}
              className="h-full w-full object-cover opacity-70"
            />
            <span
              className={cn(
                "absolute right-2 top-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset",
                STATUS_BADGE[banner.status],
              )}
            >
              {banner.status}
            </span>
            <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center text-white">
              <p className="text-xs font-medium opacity-80">{i18n("SUPER SALE")}</p>
              <h3 className="text-2xl font-black drop-shadow">{banner.title}</h3>
              <p className="text-xl font-bold text-yellow-300">
                {banner.subtitle}
              </p>
              <span className="mt-2 rounded-full bg-white/20 px-3 py-1 text-sm font-semibold">
                {banner.discount}
              </span>
            </div>
          </div>
          <div className="space-y-2 p-3">
            <p className="text-[11px] text-gray-400">
              <span className="font-mono">{banner.bgClass}</span>
              <span className="mx-2">·</span>
              {i18n("Position")}{" "}{banner.position}
              {banner.link && (
                <>
                  <span className="mx-2">·</span>
                  <span className="font-mono">→ {banner.link}</span>
                </>
              )}
            </p>
            <RowFooter
              busyId={busyId}
              banner={banner}
              onEdit={() => onEdit(banner)}
              onDelete={() => onDelete(banner)}
            />
          </div>
        </motion.article>
      ))}
      </AnimatePresence>
    </div>
  );
}
