import "server-only";
import { getRequestLocale } from "@/lib/i18n/server";
import { localizeBannerSnapshots } from "@/lib/translations/public";
import { schedulePublicTranslationStaleness } from "@/lib/translations/invalidation";

import type { BannerType, Prisma } from "@/app/generated/prisma/client";
import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import type {
  CreateCarouselBannerInput,
  CreateCategoryBannerInput,
  CreateDealBannerInput,
  CreatePromoBannerInput,
  CreateTopBannerInput,
  UpdateCarouselBannerInput,
  UpdateCategoryBannerInput,
  UpdateDealBannerInput,
  UpdatePromoBannerInput,
  UpdateTopBannerInput,
} from "@/lib/validations/banner.validation";

/**
 * The single home for Banner DB logic.
 *
 * All five marketing surfaces (carousel, category, top, deal, promo)
 * are stored in ONE unified `Banner` table, discriminated by `type`.
 * Type-specific fields (gradients, icons, badges, etc.) live in the
 * `metadata` JSON column.
 *
 * This service acts as the adapter between that unified storage and
 * the flat, per-surface row shapes the admin UI and storefront have
 * always consumed — so the routes, Redux store, and components stay
 * unchanged while the schema underneath is clean and consolidated.
 */

export class BannerError extends ServiceError {
  constructor(
    status: number,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(status, message, details);
    this.name = "BannerError";
  }
}

/* -------------------------------------------------------------------------- */
/*  Flat row shapes (the public contract, unchanged from before)              */
/* -------------------------------------------------------------------------- */

type BannerStatus = "ACTIVE" | "INACTIVE";

export type CarouselBannerRow = {
  id: string;
  image: string;
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  bgType: "gradient" | "solid";
  bgFrom: string | null;
  bgVia: string | null;
  bgTo: string | null;
  bgColor: string | null;
  link: string | null;
  position: number;
  status: BannerStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type CategoryBannerRow = {
  id: string;
  image: string;
  label: string;
  heading: string;
  discount: string;
  description: string;
  link: string | null;
  categoryId: string;
  status: BannerStatus;
  createdAt: Date;
  updatedAt: Date;
  category: { id: string; name: string; slug: string; path: string };
};

export type TopBannerRow = {
  id: string;
  icon: string;
  badge: string;
  discount: string;
  description: string;
  tag: string;
  tagIcon: string;
  link: string | null;
  position: number;
  status: BannerStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type DealBannerRow = {
  id: string;
  image: string;
  title: string;
  subtitle: string;
  bgClass: string;
  link: string | null;
  position: number;
  status: BannerStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type PromoBannerRow = {
  id: string;
  image: string;
  title: string;
  subtitle: string;
  discount: string;
  bgClass: string;
  link: string | null;
  position: number;
  status: BannerStatus;
  createdAt: Date;
  updatedAt: Date;
};

/* -------------------------------------------------------------------------- */
/*  Metadata helpers                                                          */
/* -------------------------------------------------------------------------- */

type Meta = Record<string, string | null>;

function readMeta(value: Prisma.JsonValue | null): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function metaStr(meta: Record<string, unknown>, key: string): string {
  const v = meta[key];
  return typeof v === "string" ? v : "";
}

function metaStrOrNull(meta: Record<string, unknown>, key: string): string | null {
  const v = meta[key];
  return typeof v === "string" ? v : null;
}

/** Strip null/undefined entries so we never persist empty keys. */
function cleanMeta(meta: Meta): Prisma.InputJsonValue {
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(meta)) {
    if (typeof val === "string") out[key] = val;
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Common select                                                             */
/* -------------------------------------------------------------------------- */

const bannerSelect = {
  id: true,
  type: true,
  title: true,
  subtitle: true,
  description: true,
  image: true,
  link: true,
  position: true,
  status: true,
  categoryId: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.BannerSelect;

const bannerWithCategorySelect = {
  ...bannerSelect,
  category: { select: { id: true, name: true, slug: true, path: true } },
} satisfies Prisma.BannerSelect;

type BannerRow = Prisma.BannerGetPayload<{ select: typeof bannerSelect }>;
type BannerRowWithCategory = Prisma.BannerGetPayload<{
  select: typeof bannerWithCategorySelect;
}>;

/* -------------------------------------------------------------------------- */
/*  Row mappers (unified Banner -> flat shapes)                               */
/* -------------------------------------------------------------------------- */

function toCarouselRow(b: BannerRow): CarouselBannerRow {
  const meta = readMeta(b.metadata);
  const bgType = metaStr(meta, "bgType") === "solid" ? "solid" : "gradient";
  return {
    id: b.id,
    image: b.image ?? "",
    title: b.title ?? "",
    subtitle: b.subtitle ?? "",
    description: b.description ?? "",
    badge: metaStr(meta, "badge"),
    bgType,
    bgFrom: metaStrOrNull(meta, "bgFrom"),
    bgVia: metaStrOrNull(meta, "bgVia"),
    bgTo: metaStrOrNull(meta, "bgTo"),
    bgColor: metaStrOrNull(meta, "bgColor"),
    link: b.link,
    position: b.position,
    status: b.status,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}

function toCategoryRow(b: BannerRowWithCategory): CategoryBannerRow {
  const meta = readMeta(b.metadata);
  return {
    id: b.id,
    image: b.image ?? "",
    label: metaStr(meta, "label"),
    heading: metaStr(meta, "heading"),
    discount: metaStr(meta, "discount"),
    description: b.description ?? "",
    link: b.link,
    categoryId: b.categoryId ?? "",
    status: b.status,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
    category: b.category
      ? {
          id: b.category.id,
          name: b.category.name,
          slug: b.category.slug,
          path: b.category.path,
        }
      : { id: b.categoryId ?? "", name: "", slug: "", path: "" },
  };
}

function toTopRow(b: BannerRow): TopBannerRow {
  const meta = readMeta(b.metadata);
  return {
    id: b.id,
    icon: metaStr(meta, "icon"),
    badge: metaStr(meta, "badge"),
    discount: metaStr(meta, "discount"),
    description: b.description ?? "",
    tag: metaStr(meta, "tag"),
    tagIcon: metaStr(meta, "tagIcon"),
    link: b.link,
    position: b.position,
    status: b.status,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}

function toDealRow(b: BannerRow): DealBannerRow {
  const meta = readMeta(b.metadata);
  return {
    id: b.id,
    image: b.image ?? "",
    title: b.title ?? "",
    subtitle: b.subtitle ?? "",
    bgClass: metaStr(meta, "bgClass"),
    link: b.link,
    position: b.position,
    status: b.status,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}

function toPromoRow(b: BannerRow): PromoBannerRow {
  const meta = readMeta(b.metadata);
  return {
    id: b.id,
    image: b.image ?? "",
    title: b.title ?? "",
    subtitle: b.subtitle ?? "",
    discount: metaStr(meta, "discount"),
    bgClass: metaStr(meta, "bgClass"),
    link: b.link,
    position: b.position,
    status: b.status,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}

/* -------------------------------------------------------------------------- */
/*  Aggregate read for admin                                                  */
/* -------------------------------------------------------------------------- */

export async function listAllBannersForAdmin() {
  const rows = await prisma.banner.findMany({
    orderBy: [{ position: "asc" }, { createdAt: "desc" }],
    select: bannerWithCategorySelect,
  });

  const carousel: CarouselBannerRow[] = [];
  const category: CategoryBannerRow[] = [];
  const top: TopBannerRow[] = [];
  const deal: DealBannerRow[] = [];
  const promo: PromoBannerRow[] = [];

  for (const row of rows) {
    switch (row.type) {
      case "CAROUSEL":
        carousel.push(toCarouselRow(row));
        break;
      case "CATEGORY":
        category.push(toCategoryRow(row));
        break;
      case "TOP":
        top.push(toTopRow(row));
        break;
      case "DEAL":
        deal.push(toDealRow(row));
        break;
      case "PROMO":
        promo.push(toPromoRow(row));
        break;
    }
  }

  return { carousel, category, top, deal, promo };
}

const getCachedAdminBanners = unstable_cache(
  async () => listAllBannersForAdmin(),
  ["admin-banners-aggregate"],
  { revalidate: 300, tags: ["admin-banners"] },
);

export function listAllBannersForAdminCached() {
  return getCachedAdminBanners();
}

/* -------------------------------------------------------------------------- */
/*  Shared delete guard                                                       */
/* -------------------------------------------------------------------------- */

async function deleteBannerOfType(id: string, type: BannerType) {
  const existing = await prisma.banner.findFirst({
    where: { id, type },
    select: { id: true },
  });
  if (!existing) {
    throw new BannerError(404, "Banner not found.");
  }
  return prisma.banner.delete({ where: { id }, select: bannerWithCategorySelect });
}

async function findBannerOfTypeOrThrow(id: string, type: BannerType) {
  const existing = await prisma.banner.findFirst({
    where: { id, type },
    select: { id: true },
  });
  if (!existing) {
    throw new BannerError(404, "Banner not found.");
  }
  return existing;
}

/* -------------------------------------------------------------------------- */
/*  Carousel CRUD                                                             */
/* -------------------------------------------------------------------------- */

export async function createCarouselBanner(input: CreateCarouselBannerInput) {
  const row = await prisma.banner.create({
    data: {
      type: "CAROUSEL",
      image: input.image,
      title: input.title,
      subtitle: input.subtitle,
      description: input.description,
      link: input.link ?? null,
      position: input.position,
      status: input.status,
      metadata: cleanMeta({
        badge: input.badge,
        bgType: input.bgType,
        bgFrom: input.bgFrom ?? null,
        bgVia: input.bgVia ?? null,
        bgTo: input.bgTo ?? null,
        bgColor: input.bgColor ?? null,
      }),
    },
    select: bannerSelect,
  });
  return toCarouselRow(row);
}

export async function updateCarouselBanner(
  id: string,
  input: UpdateCarouselBannerInput,
) {
  await findBannerOfTypeOrThrow(id, "CAROUSEL");

  const current = await prisma.banner.findUnique({
    where: { id },
    select: { metadata: true },
  });
  const meta = readMeta(current?.metadata ?? null);

  const data: Prisma.BannerUpdateInput = {};
  if (input.image !== undefined) data.image = input.image;
  if (input.title !== undefined) data.title = input.title;
  if (input.subtitle !== undefined) data.subtitle = input.subtitle;
  if (input.description !== undefined) data.description = input.description;
  if (input.link !== undefined) data.link = input.link;
  if (input.position !== undefined) data.position = input.position;
  if (input.status !== undefined) data.status = input.status;

  if (input.badge !== undefined) meta.badge = input.badge;
  if (input.bgType !== undefined) meta.bgType = input.bgType;
  if (input.bgFrom !== undefined) meta.bgFrom = input.bgFrom;
  if (input.bgVia !== undefined) meta.bgVia = input.bgVia;
  if (input.bgTo !== undefined) meta.bgTo = input.bgTo;
  if (input.bgColor !== undefined) meta.bgColor = input.bgColor;
  data.metadata = cleanMeta(meta as Meta);

  const row = await prisma.banner.update({
    where: { id },
    data,
    select: bannerSelect,
  });
  schedulePublicTranslationStaleness("banner",[id]);
  return toCarouselRow(row);
}

export function deleteCarouselBanner(id: string) {
  return deleteBannerOfType(id, "CAROUSEL").then(toCarouselRow);
}

/* -------------------------------------------------------------------------- */
/*  Public read for the home page hero carousel                               */
/* -------------------------------------------------------------------------- */

const getCachedActiveCarouselBanners = unstable_cache(
  async (): Promise<CarouselBannerRow[]> => {
    const rows = await prisma.banner.findMany({
      where: { type: "CAROUSEL", status: "ACTIVE" },
      orderBy: [{ position: "asc" }, { createdAt: "desc" }],
      select: bannerSelect,
    });
    return rows.map(toCarouselRow);
  },
  ["carousel-banners-active"],
  { revalidate: 600, tags: ["carousel-banners"] },
);

export async function getActiveCarouselBanners() {
  return localizeBannerSnapshots(await getCachedActiveCarouselBanners(),await getRequestLocale());
}

/* -------------------------------------------------------------------------- */
/*  Category banner CRUD                                                      */
/* -------------------------------------------------------------------------- */

export async function createCategoryBanner(input: CreateCategoryBannerInput) {
  const category = await prisma.category.findFirst({
    where: {
      id: input.categoryId,
      parentId: null,
      status: "ACTIVE",
    },
    select: { id: true, path: true },
  });
  if (!category) {
    throw new BannerError(400, "Category banners require an active root category.");
  }

  const row = await prisma.banner.create({
    data: {
      type: "CATEGORY",
      image: input.image,
      description: input.description,
      link: input.link ?? `/categories/${category.path}`,
      categoryId: input.categoryId,
      status: input.status,
      metadata: cleanMeta({
        label: input.label,
        heading: input.heading,
        discount: input.discount,
      }),
    },
    select: bannerWithCategorySelect,
  });
  return toCategoryRow(row);
}

export async function updateCategoryBanner(
  id: string,
  input: UpdateCategoryBannerInput,
) {
  await findBannerOfTypeOrThrow(id, "CATEGORY");

  let selectedCategory: { id: string; path: string } | null = null;
  if (input.categoryId !== undefined) {
    selectedCategory = await prisma.category.findFirst({
      where: {
        id: input.categoryId,
        parentId: null,
        status: "ACTIVE",
      },
      select: { id: true, path: true },
    });
    if (!selectedCategory) {
      throw new BannerError(400, "Category banners require an active root category.");
    }
  }

  const current = await prisma.banner.findUnique({
    where: { id },
    select: {
      metadata: true,
      category: { select: { path: true } },
    },
  });
  const meta = readMeta(current?.metadata ?? null);

  const data: Prisma.BannerUpdateInput = {};
  if (input.image !== undefined) data.image = input.image;
  if (input.description !== undefined) data.description = input.description;
  if (input.link !== undefined) {
    const categoryPath = selectedCategory?.path ?? current?.category?.path;
    data.link =
      input.link ?? (categoryPath ? `/categories/${categoryPath}` : null);
  }
  if (input.status !== undefined) data.status = input.status;
  if (input.categoryId !== undefined) {
    data.category = { connect: { id: input.categoryId } };
  }

  if (input.label !== undefined) meta.label = input.label;
  if (input.heading !== undefined) meta.heading = input.heading;
  if (input.discount !== undefined) meta.discount = input.discount;
  data.metadata = cleanMeta(meta as Meta);

  const row = await prisma.banner.update({
    where: { id },
    data,
    select: bannerWithCategorySelect,
  });
  schedulePublicTranslationStaleness("banner",[id]);
  return toCategoryRow(row);
}

export function deleteCategoryBanner(id: string) {
  return deleteBannerOfType(id, "CATEGORY").then(toCategoryRow);
}

/* -------------------------------------------------------------------------- */
/*  Top banner CRUD                                                           */
/* -------------------------------------------------------------------------- */

export async function createTopBanner(input: CreateTopBannerInput) {
  const row = await prisma.banner.create({
    data: {
      type: "TOP",
      description: input.description,
      link: input.link ?? null,
      position: input.position,
      status: input.status,
      metadata: cleanMeta({
        icon: input.icon,
        badge: input.badge,
        discount: input.discount,
        tag: input.tag,
        tagIcon: input.tagIcon,
      }),
    },
    select: bannerSelect,
  });
  return toTopRow(row);
}

export async function updateTopBanner(id: string, input: UpdateTopBannerInput) {
  await findBannerOfTypeOrThrow(id, "TOP");

  const current = await prisma.banner.findUnique({
    where: { id },
    select: { metadata: true },
  });
  const meta = readMeta(current?.metadata ?? null);

  const data: Prisma.BannerUpdateInput = {};
  if (input.description !== undefined) data.description = input.description;
  if (input.link !== undefined) data.link = input.link;
  if (input.position !== undefined) data.position = input.position;
  if (input.status !== undefined) data.status = input.status;

  if (input.icon !== undefined) meta.icon = input.icon;
  if (input.badge !== undefined) meta.badge = input.badge;
  if (input.discount !== undefined) meta.discount = input.discount;
  if (input.tag !== undefined) meta.tag = input.tag;
  if (input.tagIcon !== undefined) meta.tagIcon = input.tagIcon;
  data.metadata = cleanMeta(meta as Meta);

  const row = await prisma.banner.update({
    where: { id },
    data,
    select: bannerSelect,
  });
  schedulePublicTranslationStaleness("banner",[id]);
  return toTopRow(row);
}

export function deleteTopBanner(id: string) {
  return deleteBannerOfType(id, "TOP").then(toTopRow);
}

/* -------------------------------------------------------------------------- */
/*  Deal banner CRUD (product-details carousel)                               */
/* -------------------------------------------------------------------------- */

export async function createDealBanner(input: CreateDealBannerInput) {
  const row = await prisma.banner.create({
    data: {
      type: "DEAL",
      image: input.image,
      title: input.title,
      subtitle: input.subtitle,
      link: input.link ?? null,
      position: input.position,
      status: input.status,
      metadata: cleanMeta({ bgClass: input.bgClass }),
    },
    select: bannerSelect,
  });
  return toDealRow(row);
}

export async function updateDealBanner(id: string, input: UpdateDealBannerInput) {
  await findBannerOfTypeOrThrow(id, "DEAL");

  const current = await prisma.banner.findUnique({
    where: { id },
    select: { metadata: true },
  });
  const meta = readMeta(current?.metadata ?? null);

  const data: Prisma.BannerUpdateInput = {};
  if (input.image !== undefined) data.image = input.image;
  if (input.title !== undefined) data.title = input.title;
  if (input.subtitle !== undefined) data.subtitle = input.subtitle;
  if (input.link !== undefined) data.link = input.link;
  if (input.position !== undefined) data.position = input.position;
  if (input.status !== undefined) data.status = input.status;

  if (input.bgClass !== undefined) meta.bgClass = input.bgClass;
  data.metadata = cleanMeta(meta as Meta);

  const row = await prisma.banner.update({
    where: { id },
    data,
    select: bannerSelect,
  });
  schedulePublicTranslationStaleness("banner",[id]);
  return toDealRow(row);
}

export function deleteDealBanner(id: string) {
  return deleteBannerOfType(id, "DEAL").then(toDealRow);
}

/* -------------------------------------------------------------------------- */
/*  Promo banner CRUD (product-details side rail)                             */
/* -------------------------------------------------------------------------- */

export async function createPromoBanner(input: CreatePromoBannerInput) {
  const row = await prisma.banner.create({
    data: {
      type: "PROMO",
      image: input.image,
      title: input.title,
      subtitle: input.subtitle,
      link: input.link ?? null,
      position: input.position,
      status: input.status,
      metadata: cleanMeta({ discount: input.discount, bgClass: input.bgClass }),
    },
    select: bannerSelect,
  });
  return toPromoRow(row);
}

export async function updatePromoBanner(
  id: string,
  input: UpdatePromoBannerInput,
) {
  await findBannerOfTypeOrThrow(id, "PROMO");

  const current = await prisma.banner.findUnique({
    where: { id },
    select: { metadata: true },
  });
  const meta = readMeta(current?.metadata ?? null);

  const data: Prisma.BannerUpdateInput = {};
  if (input.image !== undefined) data.image = input.image;
  if (input.title !== undefined) data.title = input.title;
  if (input.subtitle !== undefined) data.subtitle = input.subtitle;
  if (input.link !== undefined) data.link = input.link;
  if (input.position !== undefined) data.position = input.position;
  if (input.status !== undefined) data.status = input.status;

  if (input.discount !== undefined) meta.discount = input.discount;
  if (input.bgClass !== undefined) meta.bgClass = input.bgClass;
  data.metadata = cleanMeta(meta as Meta);

  const row = await prisma.banner.update({
    where: { id },
    data,
    select: bannerSelect,
  });
  schedulePublicTranslationStaleness("banner",[id]);
  return toPromoRow(row);
}

export function deletePromoBanner(id: string) {
  return deleteBannerOfType(id, "PROMO").then(toPromoRow);
}

/* -------------------------------------------------------------------------- */
/*  Public reads for the product-details page                                 */
/* -------------------------------------------------------------------------- */

const getCachedActiveDealBanners = unstable_cache(
  async (): Promise<DealBannerRow[]> => {
    const rows = await prisma.banner.findMany({
      where: { type: "DEAL", status: "ACTIVE" },
      orderBy: [{ position: "asc" }, { createdAt: "desc" }],
      select: bannerSelect,
    });
    return rows.map(toDealRow);
  },
  ["deal-banners-active"],
  { revalidate: 900, tags: ["deal-banners"] },
);

export async function getActiveDealBanners() {
  return localizeBannerSnapshots(await getCachedActiveDealBanners(),await getRequestLocale());
}

const getCachedActivePromoBanners = unstable_cache(
  async (): Promise<PromoBannerRow[]> => {
    const rows = await prisma.banner.findMany({
      where: { type: "PROMO", status: "ACTIVE" },
      orderBy: [{ position: "asc" }, { createdAt: "desc" }],
      select: bannerSelect,
    });
    return rows.map(toPromoRow);
  },
  ["promo-banners-active"],
  { revalidate: 900, tags: ["promo-banners"] },
);

export async function getActivePromoBanners() {
  return localizeBannerSnapshots(await getCachedActivePromoBanners(),await getRequestLocale());
}

/* -------------------------------------------------------------------------- */
/*  Public read for the site-wide top promo strip                             */
/* -------------------------------------------------------------------------- */

const getCachedActiveTopBanners = unstable_cache(
  async (): Promise<TopBannerRow[]> => {
    const rows = await prisma.banner.findMany({
      where: { type: "TOP", status: "ACTIVE" },
      orderBy: [{ position: "asc" }, { createdAt: "desc" }],
      select: bannerSelect,
    });
    return rows.map(toTopRow);
  },
  ["top-banners-active"],
  { revalidate: 1800, tags: ["top-banners"] },
);

export async function getActiveTopBanners() {
  return localizeBannerSnapshots(await getCachedActiveTopBanners(),await getRequestLocale());
}
