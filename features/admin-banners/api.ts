import { readApiError } from "@/features/http/api-envelope";

export type BannerStatus = "ACTIVE" | "INACTIVE";

export type BannerKind = "carousel" | "category" | "top" | "deal" | "promo";

export type CarouselBgType = "gradient" | "solid";

export const STATUS_VALUES: readonly BannerStatus[] = ["ACTIVE", "INACTIVE"];

export const CAROUSEL_BG_TYPES: readonly CarouselBgType[] = [
  "gradient",
  "solid",
];

/* -------------------------------------------------------------------------- */
/*  Row shapes                                                                */
/* -------------------------------------------------------------------------- */

export type CarouselBannerRow = {
  id: string;
  image: string;
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  bgType: CarouselBgType;
  bgFrom: string | null;
  bgVia: string | null;
  bgTo: string | null;
  bgColor: string | null;
  link: string | null;
  position: number;
  status: BannerStatus;
  createdAt: string;
  updatedAt: string;
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
  createdAt: string;
  updatedAt: string;
  category: {
    id: string;
    name: string;
    slug: string;
    path: string;
  };
};

export type CategoryBannerCategoryOption = {
  id: string;
  name: string;
  slug: string;
  path: string;
  parentId: string | null;
  depth: number;
  position: number;
  status: BannerStatus;
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
  createdAt: string;
  updatedAt: string;
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
  createdAt: string;
  updatedAt: string;
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
  createdAt: string;
  updatedAt: string;
};

export type AdminBannersBundle = {
  carousel: CarouselBannerRow[];
  category: CategoryBannerRow[];
  top: TopBannerRow[];
  deal: DealBannerRow[];
  promo: PromoBannerRow[];
};

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  meta?: unknown;
};

/* -------------------------------------------------------------------------- */
/*  Form shapes                                                               */
/* -------------------------------------------------------------------------- */

export type CarouselFormState = {
  image: string;
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  bgType: CarouselBgType;
  bgFrom: string;
  bgVia: string;
  bgTo: string;
  bgColor: string;
  link: string;
  position: string;
  status: BannerStatus;
};

export const EMPTY_CAROUSEL_FORM: CarouselFormState = {
  image: "",
  title: "",
  subtitle: "",
  description: "",
  badge: "",
  bgType: "gradient",
  bgFrom: "#8b5cf6",
  bgVia: "#6366f1",
  bgTo: "#1d4ed8",
  bgColor: "#7c3aed",
  link: "",
  position: "0",
  status: "ACTIVE",
};

export type CategoryBannerFormState = {
  image: string;
  label: string;
  heading: string;
  discount: string;
  description: string;
  link: string;
  categoryId: string;
  status: BannerStatus;
};

export const EMPTY_CATEGORY_BANNER_FORM: CategoryBannerFormState = {
  image: "",
  label: "",
  heading: "",
  discount: "",
  description: "",
  link: "",
  categoryId: "",
  status: "ACTIVE",
};

export type TopFormState = {
  icon: string;
  badge: string;
  discount: string;
  description: string;
  tag: string;
  tagIcon: string;
  link: string;
  position: string;
  status: BannerStatus;
};

export const EMPTY_TOP_FORM: TopFormState = {
  icon: "Tag",
  badge: "",
  discount: "",
  description: "",
  tag: "",
  tagIcon: "Sparkles",
  link: "",
  position: "0",
  status: "ACTIVE",
};

export type DealFormState = {
  image: string;
  title: string;
  subtitle: string;
  bgClass: string;
  link: string;
  position: string;
  status: BannerStatus;
};

export const EMPTY_DEAL_FORM: DealFormState = {
  image: "",
  title: "",
  subtitle: "",
  bgClass: "#f43f5e",
  link: "",
  position: "0",
  status: "ACTIVE",
};

export type PromoFormState = {
  image: string;
  title: string;
  subtitle: string;
  discount: string;
  bgClass: string;
  link: string;
  position: string;
  status: BannerStatus;
};

export const EMPTY_PROMO_FORM: PromoFormState = {
  image: "",
  title: "",
  subtitle: "",
  discount: "",
  bgClass: "#6d28d9",
  link: "",
  position: "0",
  status: "ACTIVE",
};

/* -------------------------------------------------------------------------- */
/*  Parsers                                                                   */
/* -------------------------------------------------------------------------- */

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function parseStatus(value: unknown): BannerStatus {
  return value === "INACTIVE" ? "INACTIVE" : "ACTIVE";
}

function parseCarouselBgType(value: unknown): CarouselBgType {
  return value === "solid" ? "solid" : "gradient";
}

function parseCarousel(entry: unknown): CarouselBannerRow {
  const item = (entry ?? {}) as Partial<CarouselBannerRow>;
  return {
    id: asString(item.id),
    image: asString(item.image),
    title: asString(item.title),
    subtitle: asString(item.subtitle),
    description: asString(item.description),
    badge: asString(item.badge),
    bgType: parseCarouselBgType(item.bgType),
    bgFrom: asNullableString(item.bgFrom),
    bgVia: asNullableString(item.bgVia),
    bgTo: asNullableString(item.bgTo),
    bgColor: asNullableString(item.bgColor),
    link: asNullableString(item.link),
    position: Number(item.position ?? 0),
    status: parseStatus(item.status),
    createdAt: asString(item.createdAt),
    updatedAt: asString(item.updatedAt),
  };
}

function parseCategoryBanner(entry: unknown): CategoryBannerRow {
  const item = (entry ?? {}) as Partial<CategoryBannerRow> & {
    category?: unknown;
  };
  const category = (item.category ?? {}) as Partial<
    CategoryBannerRow["category"]
  >;

  return {
    id: asString(item.id),
    image: asString(item.image),
    label: asString(item.label),
    heading: asString(item.heading),
    discount: asString(item.discount),
    description: asString(item.description),
    link: asNullableString(item.link),
    categoryId: asString(item.categoryId),
    status: parseStatus(item.status),
    createdAt: asString(item.createdAt),
    updatedAt: asString(item.updatedAt),
    category: {
      id: asString(category.id),
      name: asString(category.name),
      slug: asString(category.slug),
      path: asString(category.path) || asString(category.slug),
    },
  };
}

function parseTop(entry: unknown): TopBannerRow {
  const item = (entry ?? {}) as Partial<TopBannerRow>;
  return {
    id: asString(item.id),
    icon: asString(item.icon),
    badge: asString(item.badge),
    discount: asString(item.discount),
    description: asString(item.description),
    tag: asString(item.tag),
    tagIcon: asString(item.tagIcon),
    link: asNullableString(item.link),
    position: Number(item.position ?? 0),
    status: parseStatus(item.status),
    createdAt: asString(item.createdAt),
    updatedAt: asString(item.updatedAt),
  };
}

function parseDeal(entry: unknown): DealBannerRow {
  const item = (entry ?? {}) as Partial<DealBannerRow>;
  return {
    id: asString(item.id),
    image: asString(item.image),
    title: asString(item.title),
    subtitle: asString(item.subtitle),
    bgClass: asString(item.bgClass),
    link: asNullableString(item.link),
    position: Number(item.position ?? 0),
    status: parseStatus(item.status),
    createdAt: asString(item.createdAt),
    updatedAt: asString(item.updatedAt),
  };
}

function parsePromo(entry: unknown): PromoBannerRow {
  const item = (entry ?? {}) as Partial<PromoBannerRow>;
  return {
    id: asString(item.id),
    image: asString(item.image),
    title: asString(item.title),
    subtitle: asString(item.subtitle),
    discount: asString(item.discount),
    bgClass: asString(item.bgClass),
    link: asNullableString(item.link),
    position: Number(item.position ?? 0),
    status: parseStatus(item.status),
    createdAt: asString(item.createdAt),
    updatedAt: asString(item.updatedAt),
  };
}

export function parseBannersBundle(payload: unknown): AdminBannersBundle {
  const envelope = payload as ApiEnvelope<unknown>;
  if (!envelope?.success || typeof envelope.data !== "object" || envelope.data === null) {
    throw new Error("Banners API returned an invalid response.");
  }

  const data = envelope.data as Partial<{
    carousel: unknown;
    category: unknown;
    top: unknown;
    deal: unknown;
    promo: unknown;
  }>;

  return {
    carousel: Array.isArray(data.carousel) ? data.carousel.map(parseCarousel) : [],
    category: Array.isArray(data.category)
      ? data.category.map(parseCategoryBanner)
      : [],
    top: Array.isArray(data.top) ? data.top.map(parseTop) : [],
    deal: Array.isArray(data.deal) ? data.deal.map(parseDeal) : [],
    promo: Array.isArray(data.promo) ? data.promo.map(parsePromo) : [],
  };
}

/* -------------------------------------------------------------------------- */
/*  HTTP helpers                                                              */
/* -------------------------------------------------------------------------- */

async function readJson(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

export async function fetchAllBanners(): Promise<AdminBannersBundle> {
  const response = await fetch(`/api/admin/banners`, {
    method: "GET",
    cache: "no-store",
  });
  const payload = await readJson(response);

  if (!response.ok) {
    throw new Error(readApiError(payload, "Failed to load banners."));
  }
  return parseBannersBundle(payload);
}

/** Category banners intentionally target only visible top-level sections. */
export async function fetchActiveRootBannerCategories(): Promise<
  CategoryBannerCategoryOption[]
> {
  const params = new URLSearchParams({
    view: "flat",
    status: "ACTIVE",
    parentId: "root",
    sort: "position",
    pageSize: "500",
  });
  const response = await fetch(`/api/categories?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(
      readApiError(payload, "Failed to load active root categories."),
    );
  }

  const envelope = payload as ApiEnvelope<unknown>;
  const rows = Array.isArray(envelope?.data) ? envelope.data : [];
  return rows
    .flatMap((entry): CategoryBannerCategoryOption[] => {
      if (!entry || typeof entry !== "object") return [];
      const row = entry as Record<string, unknown>;
      const id = asString(row.id);
      const name = asString(row.name);
      const slug = asString(row.slug);
      const path = asString(row.path) || slug;
      const parentId = typeof row.parentId === "string" ? row.parentId : null;
      const depth = Number(row.depth ?? 0);
      const position = Number(row.position ?? 0);
      const status = parseStatus(row.status);

      if (
        !id ||
        !name ||
        !path ||
        row.status !== "ACTIVE" ||
        parentId !== null ||
        depth !== 0
      ) {
        return [];
      }
      return [{ id, name, slug, path, parentId, depth, position, status }];
    })
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
}

export function categoryBannerHref(path: string): string {
  const canonical = path.trim().replace(/^\/+|\/+$/g, "");
  return canonical ? `/categories/${canonical}` : "/categories";
}

type CarouselCreateBody = {
  image: string;
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  bgType: CarouselBgType;
  bgFrom: string | null;
  bgVia: string | null;
  bgTo: string | null;
  bgColor: string | null;
  link: string | null;
  position: number;
  status: BannerStatus;
};

type CarouselUpdateBody = Partial<CarouselCreateBody>;

export async function createCarouselBanner(
  body: CarouselCreateBody,
): Promise<CarouselBannerRow> {
  const response = await fetch(`/api/admin/banners/carousel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(readApiError(payload, "Failed to create carousel banner."));
  }
  const envelope = payload as ApiEnvelope<unknown>;
  return parseCarousel(envelope?.data);
}

export async function updateCarouselBanner(
  id: string,
  body: CarouselUpdateBody,
): Promise<CarouselBannerRow> {
  const response = await fetch(`/api/admin/banners/carousel/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(readApiError(payload, "Failed to update carousel banner."));
  }
  const envelope = payload as ApiEnvelope<unknown>;
  return parseCarousel(envelope?.data);
}

export async function deleteCarouselBanner(id: string): Promise<void> {
  const response = await fetch(`/api/admin/banners/carousel/${id}`, {
    method: "DELETE",
    cache: "no-store",
  });
  if (!response.ok) {
    const payload = await readJson(response);
    throw new Error(readApiError(payload, "Failed to delete carousel banner."));
  }
}

type CategoryBannerCreateBody = {
  image: string;
  label: string;
  heading: string;
  discount: string;
  description: string;
  link: string | null;
  categoryId: string;
  status: BannerStatus;
};

type CategoryBannerUpdateBody = Partial<CategoryBannerCreateBody>;

export async function createCategoryBanner(
  body: CategoryBannerCreateBody,
): Promise<CategoryBannerRow> {
  const response = await fetch(`/api/admin/banners/category`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(readApiError(payload, "Failed to create category banner."));
  }
  const envelope = payload as ApiEnvelope<unknown>;
  return parseCategoryBanner(envelope?.data);
}

export async function updateCategoryBanner(
  id: string,
  body: CategoryBannerUpdateBody,
): Promise<CategoryBannerRow> {
  const response = await fetch(`/api/admin/banners/category/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(readApiError(payload, "Failed to update category banner."));
  }
  const envelope = payload as ApiEnvelope<unknown>;
  return parseCategoryBanner(envelope?.data);
}

export async function deleteCategoryBanner(id: string): Promise<void> {
  const response = await fetch(`/api/admin/banners/category/${id}`, {
    method: "DELETE",
    cache: "no-store",
  });
  if (!response.ok) {
    const payload = await readJson(response);
    throw new Error(readApiError(payload, "Failed to delete category banner."));
  }
}

type TopCreateBody = {
  icon: string;
  badge: string;
  discount: string;
  description: string;
  tag: string;
  tagIcon: string;
  link: string | null;
  position: number;
  status: BannerStatus;
};

type TopUpdateBody = Partial<TopCreateBody>;

export async function createTopBanner(
  body: TopCreateBody,
): Promise<TopBannerRow> {
  const response = await fetch(`/api/admin/banners/top`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(readApiError(payload, "Failed to create top banner."));
  }
  const envelope = payload as ApiEnvelope<unknown>;
  return parseTop(envelope?.data);
}

export async function updateTopBanner(
  id: string,
  body: TopUpdateBody,
): Promise<TopBannerRow> {
  const response = await fetch(`/api/admin/banners/top/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(readApiError(payload, "Failed to update top banner."));
  }
  const envelope = payload as ApiEnvelope<unknown>;
  return parseTop(envelope?.data);
}

export async function deleteTopBanner(id: string): Promise<void> {
  const response = await fetch(`/api/admin/banners/top/${id}`, {
    method: "DELETE",
    cache: "no-store",
  });
  if (!response.ok) {
    const payload = await readJson(response);
    throw new Error(readApiError(payload, "Failed to delete top banner."));
  }
}

/* -------------------------------------------------------------------------- */
/*  Deal banner HTTP                                                          */
/* -------------------------------------------------------------------------- */

type DealCreateBody = {
  image: string;
  title: string;
  subtitle: string;
  bgClass: string;
  link: string | null;
  position: number;
  status: BannerStatus;
};

type DealUpdateBody = Partial<DealCreateBody>;

export async function createDealBanner(
  body: DealCreateBody,
): Promise<DealBannerRow> {
  const response = await fetch(`/api/admin/banners/deal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(readApiError(payload, "Failed to create deal banner."));
  }
  const envelope = payload as ApiEnvelope<unknown>;
  return parseDeal(envelope?.data);
}

export async function updateDealBanner(
  id: string,
  body: DealUpdateBody,
): Promise<DealBannerRow> {
  const response = await fetch(`/api/admin/banners/deal/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(readApiError(payload, "Failed to update deal banner."));
  }
  const envelope = payload as ApiEnvelope<unknown>;
  return parseDeal(envelope?.data);
}

export async function deleteDealBanner(id: string): Promise<void> {
  const response = await fetch(`/api/admin/banners/deal/${id}`, {
    method: "DELETE",
    cache: "no-store",
  });
  if (!response.ok) {
    const payload = await readJson(response);
    throw new Error(readApiError(payload, "Failed to delete deal banner."));
  }
}

/* -------------------------------------------------------------------------- */
/*  Promo banner HTTP                                                         */
/* -------------------------------------------------------------------------- */

type PromoCreateBody = {
  image: string;
  title: string;
  subtitle: string;
  discount: string;
  bgClass: string;
  link: string | null;
  position: number;
  status: BannerStatus;
};

type PromoUpdateBody = Partial<PromoCreateBody>;

export async function createPromoBanner(
  body: PromoCreateBody,
): Promise<PromoBannerRow> {
  const response = await fetch(`/api/admin/banners/promo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(readApiError(payload, "Failed to create promo banner."));
  }
  const envelope = payload as ApiEnvelope<unknown>;
  return parsePromo(envelope?.data);
}

export async function updatePromoBanner(
  id: string,
  body: PromoUpdateBody,
): Promise<PromoBannerRow> {
  const response = await fetch(`/api/admin/banners/promo/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(readApiError(payload, "Failed to update promo banner."));
  }
  const envelope = payload as ApiEnvelope<unknown>;
  return parsePromo(envelope?.data);
}

export async function deletePromoBanner(id: string): Promise<void> {
  const response = await fetch(`/api/admin/banners/promo/${id}`, {
    method: "DELETE",
    cache: "no-store",
  });
  if (!response.ok) {
    const payload = await readJson(response);
    throw new Error(readApiError(payload, "Failed to delete promo banner."));
  }
}

/* -------------------------------------------------------------------------- */
/*  Form helpers                                                              */
/* -------------------------------------------------------------------------- */

export function buildCarouselForm(
  banner: CarouselBannerRow,
): CarouselFormState {
  return {
    image: banner.image,
    title: banner.title,
    subtitle: banner.subtitle,
    description: banner.description,
    badge: banner.badge,
    bgType: banner.bgType,
    bgFrom: banner.bgFrom ?? "",
    bgVia: banner.bgVia ?? "",
    bgTo: banner.bgTo ?? "",
    bgColor: banner.bgColor ?? "",
    link: banner.link ?? "",
    position: String(banner.position),
    status: banner.status,
  };
}

export function buildCategoryBannerForm(
  banner: CategoryBannerRow,
): CategoryBannerFormState {
  return {
    image: banner.image,
    label: banner.label,
    heading: banner.heading,
    discount: banner.discount,
    description: banner.description,
    link: banner.link ?? categoryBannerHref(banner.category.path),
    categoryId: banner.categoryId,
    status: banner.status,
  };
}

export function buildTopForm(banner: TopBannerRow): TopFormState {
  return {
    icon: banner.icon,
    badge: banner.badge,
    discount: banner.discount,
    description: banner.description,
    tag: banner.tag,
    tagIcon: banner.tagIcon,
    link: banner.link ?? "",
    position: String(banner.position),
    status: banner.status,
  };
}

export function buildDealForm(banner: DealBannerRow): DealFormState {
  return {
    image: banner.image,
    title: banner.title,
    subtitle: banner.subtitle,
    bgClass: banner.bgClass,
    link: banner.link ?? "",
    position: String(banner.position),
    status: banner.status,
  };
}

export function buildPromoForm(banner: PromoBannerRow): PromoFormState {
  return {
    image: banner.image,
    title: banner.title,
    subtitle: banner.subtitle,
    discount: banner.discount,
    bgClass: banner.bgClass,
    link: banner.link ?? "",
    position: String(banner.position),
    status: banner.status,
  };
}

export function parseIntSafe(value: string, field: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(`${field} must be a valid number.`);
  }
  if (!Number.isInteger(n)) {
    throw new Error(`${field} must be a whole number.`);
  }
  if (n < 0) {
    throw new Error(`${field} cannot be negative.`);
  }
  return n;
}

export function formatDate(value: string | null | undefined, locale = "en"): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}
