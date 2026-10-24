import "server-only";

import { Prisma } from "@/app/generated/prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";

import { cleanOptionalText } from "@/lib/catalog/catalog-entity";
import { resolveProductColorWrite } from "@/lib/catalog/product-color";
import {
  cleanVariantAttributes,
  deriveVariantKey,
  formatVariantAttributes,
} from "@/lib/catalog/variant-options";
import { prisma } from "@/lib/db/prisma";
import {
  catalogRoutePath,
  deleteCatalogRedirectsForEntity,
  getCatalogRedirectByPath,
  recordCatalogRedirectMoves,
  releaseCatalogRedirectSources,
  type CatalogRedirectDto,
} from "@/lib/services/catalog-redirect.service";
import { ServiceError } from "@/lib/services/service-error";
import {
  getCategoryBreadcrumbsByIds,
  getCategorySubtreeIds,
  getEffectiveActiveCategoryIds,
  isCategoryEffectivelyActive,
  type CategoryBreadcrumb,
} from "@/lib/services/category.service";
import type {
  CreateProductInput,
  ProductQueryInput,
  ProductVariantInput,
  UpdateProductInput,
} from "@/lib/validations/product.validation";

export class ProductError extends ServiceError {
  constructor(
    status: number,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(status, message, details);
    this.name = "ProductError";
  }
}

const productInclude = {
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
      path: true,
      depth: true,
      parentId: true,
      image: true,
      seoTitle: true,
      metaDescription: true,
      ogImage: true,
      status: true,
    },
  },
  brand: {
    select: {
      id: true,
      name: true,
      slug: true,
      logo: true,
      website: true,
      seoTitle: true,
      metaDescription: true,
      ogImage: true,
      status: true,
    },
  },
  manufacturer: {
    select: {
      id: true,
      name: true,
      slug: true,
      logo: true,
      website: true,
      country: true,
      status: true,
    },
  },
  images: { orderBy: { position: "asc" } },
  variants: { orderBy: { createdAt: "asc" } },
  reviews: { select: { rating: true } },
} satisfies Prisma.ProductInclude;

type ProductRow = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

export type ProductWithCategory = ProductRow & {
  categoryBreadcrumb: CategoryBreadcrumb[];
};

export type SerializeOptions = {
  /** Admin-only business source cost. */
  includeBuyingPrice?: boolean;
};

export type ListProductsOptions = {
  /** Enforce active product + complete active category ancestry. Default true. */
  publicOnly?: boolean;
};

export function effectiveProductPrice(product: {
  salePrice: Prisma.Decimal;
  discountPrice: Prisma.Decimal | null;
}): number {
  const sale = product.salePrice.toNumber();
  const discount = product.discountPrice?.toNumber() ?? null;
  return discount != null && discount < sale ? discount : sale;
}

function productRating(product: Pick<ProductRow, "reviews">) {
  const reviewCount = product.reviews.length;
  const rating =
    reviewCount === 0
      ? 0
      : product.reviews.reduce((sum, review) => sum + review.rating, 0) /
        reviewCount;
  return { rating, reviewCount };
}

function jsonObject(
  value: Prisma.JsonValue | null,
): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function serializeProduct(
  product: ProductWithCategory,
  options: SerializeOptions = {},
) {
  const salePrice = product.salePrice.toNumber();
  const rawDiscount = product.discountPrice?.toNumber() ?? null;
  const discountPrice =
    rawDiscount != null && rawDiscount < salePrice ? rawDiscount : null;
  const imageDetails = product.images.map((image, position) => ({
    url: image.url,
    alt:
      image.alt?.trim() ||
      (position === 0 ? product.name : `${product.name} image ${position + 1}`),
    position: image.position,
  }));
  const imageUrls = imageDetails.map((image) => image.url);
  const activeVariants = product.variants.filter((variant) => variant.isActive);
  const totalStock = activeVariants.reduce(
    (sum, variant) => sum + variant.stock,
    0,
  );
  const primary = activeVariants[0] ?? product.variants[0];
  const { rating, reviewCount } = productRating(product);

  return {
    id: product.id,
    productCode: product.productCode,
    name: product.name,
    slug: product.slug,
    description: product.description,
    descriptionBlocks: product.descriptionBlocks ?? null,
    seoTitle: product.seoTitle,
    metaDescription: product.metaDescription,
    ogImage: product.ogImage,
    gtin: product.gtin,
    itemCondition: product.itemCondition,
    modelNumber: product.modelNumber,
    series: product.series,
    specifications: jsonObject(product.specifications),
    price: salePrice,
    salePrice,
    discountPrice,
    ...(options.includeBuyingPrice
      ? { buyingPrice: product.buyingPrice.toNumber() }
      : {}),
    stock: totalStock,
    inStock: totalStock > 0,
    image: imageUrls[0] ?? null,
    images: imageUrls,
    imageAlt: imageDetails[0]?.alt ?? product.name,
    imageDetails,
    rating,
    reviewCount,
    badge: null,
    color: primary?.color ?? null,
    size: primary?.size ?? null,
    variantCount: activeVariants.length,
    status: product.status,
    categoryId: product.categoryId,
    categoryPath: product.category.path,
    category: {
      id: product.category.id,
      name: product.category.name,
      slug: product.category.slug,
      path: product.category.path,
      depth: product.category.depth,
      parentId: product.category.parentId,
      image: product.category.image,
      seoTitle: product.category.seoTitle,
      metaDescription: product.category.metaDescription,
      ogImage: product.category.ogImage,
      status: product.category.status,
    },
    categoryBreadcrumb: product.categoryBreadcrumb,
    brandId: product.brandId,
    brand: product.brand,
    manufacturerId: product.manufacturerId,
    manufacturer: product.manufacturer,
    variants: product.variants.map((variant) => {
      const attributes = cleanVariantAttributes(variant.attributes);
      return {
        id: variant.id,
        variantKey: variant.variantKey,
        name: variant.name,
        sku: variant.sku,
        modelNumber: variant.modelNumber,
        color: variant.color,
        size: variant.size,
        attributes,
        attributeSummary: formatVariantAttributes(attributes),
        stock: variant.stock,
        image: variant.image,
        isActive: variant.isActive,
      };
    }),
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

function slugify(name: string): string {
  return (
    name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "product"
  );
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  const existing = await prisma.product.findMany({
    where: { OR: [{ slug: base }, { slug: { startsWith: `${base}-` } }] },
    select: { slug: true },
  });
  const used = new Set(existing.map((row) => row.slug));
  if (!used.has(base)) return base;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
}

const PRODUCT_CODE_PREFIX = "PRD-";
const PRODUCT_CODE_PAD = 5;

function formatProductCode(sequence: number): string {
  return `${PRODUCT_CODE_PREFIX}${String(sequence).padStart(PRODUCT_CODE_PAD, "0")}`;
}

async function nextProductCode(): Promise<string> {
  const last = await prisma.product.findFirst({
    where: { productCode: { startsWith: PRODUCT_CODE_PREFIX } },
    orderBy: { productCode: "desc" },
    select: { productCode: true },
  });
  const lastSequence = last
    ? Number.parseInt(last.productCode.slice(PRODUCT_CODE_PREFIX.length), 10)
    : 0;
  return formatProductCode(
    Number.isFinite(lastSequence) ? lastSequence + 1 : 1,
  );
}

async function withBreadcrumbs(
  rows: readonly ProductRow[],
): Promise<ProductWithCategory[]> {
  const breadcrumbs = await getCategoryBreadcrumbsByIds(
    rows.map((row) => row.categoryId),
  );
  return rows.map((row) => ({
    ...row,
    categoryBreadcrumb: breadcrumbs.get(row.categoryId) ?? [],
  }));
}

async function resolveCategoryIds(
  query: ProductQueryInput,
  publicOnly: boolean,
): Promise<string[] | undefined> {
  let selected: Set<string> | undefined = publicOnly
    ? new Set(await getEffectiveActiveCategoryIds())
    : undefined;

  const identifiers = [
    ...(query.categoryId ? [{ id: query.categoryId } as const] : []),
    ...(query.categoryPath ? [{ path: query.categoryPath } as const] : []),
  ];

  for (const identifier of identifiers) {
    const subtree = new Set(
      await getCategorySubtreeIds(identifier, {
        effectiveActiveOnly: publicOnly,
      }),
    );
    if (subtree.size === 0) return [];
    selected = selected
      ? new Set([...selected].filter((id) => subtree.has(id)))
      : subtree;
  }

  return selected ? [...selected] : undefined;
}

function priceWhere(query: ProductQueryInput): Prisma.ProductWhereInput | null {
  if (query.minPrice == null && query.maxPrice == null) return null;
  const range = {
    ...(query.minPrice != null ? { gte: query.minPrice } : {}),
    ...(query.maxPrice != null ? { lte: query.maxPrice } : {}),
  };
  return {
    OR: [
      { discountPrice: { not: null, ...range } },
      { discountPrice: null, salePrice: range },
    ],
  };
}

function buildWhere(
  query: ProductQueryInput,
  categoryIds: string[] | undefined,
  publicOnly: boolean,
): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [];

  if (query.search) {
    and.push({
      OR: [
        { name: { contains: query.search, mode: "insensitive" } },
        { productCode: { contains: query.search, mode: "insensitive" } },
        { modelNumber: { contains: query.search, mode: "insensitive" } },
        { series: { contains: query.search, mode: "insensitive" } },
        { category: { name: { contains: query.search, mode: "insensitive" } } },
        { category: { path: { contains: query.search, mode: "insensitive" } } },
        { brand: { name: { contains: query.search, mode: "insensitive" } } },
        {
          manufacturer: {
            name: { contains: query.search, mode: "insensitive" },
          },
        },
        {
          variants: {
            some: {
              OR: [
                { sku: { contains: query.search, mode: "insensitive" } },
                {
                  modelNumber: {
                    contains: query.search,
                    mode: "insensitive",
                  },
                },
              ],
            },
          },
        },
      ],
    });
  }

  if (categoryIds) and.push({ categoryId: { in: categoryIds } });
  if (publicOnly) and.push({ status: "ACTIVE" });
  else if (query.status) and.push({ status: query.status });
  if (query.brandId) {
    and.push(
      publicOnly
        ? { brand: { id: query.brandId, status: "ACTIVE" } }
        : { brandId: query.brandId },
    );
  }
  if (query.brandSlug) {
    and.push({
      brand: {
        slug: query.brandSlug,
        ...(publicOnly ? { status: "ACTIVE" as const } : {}),
      },
    });
  }
  if (query.manufacturerId) {
    and.push(
      publicOnly
        ? {
            manufacturer: {
              id: query.manufacturerId,
              status: "ACTIVE",
            },
          }
        : { manufacturerId: query.manufacturerId },
    );
  }
  if (query.manufacturerSlug) {
    and.push({
      manufacturer: {
        slug: query.manufacturerSlug,
        ...(publicOnly ? { status: "ACTIVE" as const } : {}),
      },
    });
  }
  if (query.stock === "in-stock") {
    and.push({ variants: { some: { isActive: true, stock: { gt: 0 } } } });
  } else if (query.stock === "out-of-stock") {
    and.push({
      NOT: { variants: { some: { isActive: true, stock: { gt: 0 } } } },
    });
  }
  const price = priceWhere(query);
  if (price) and.push(price);

  return and.length > 0 ? { AND: and } : {};
}

function buildOrderBy(
  sort: ProductQueryInput["sort"],
): Prisma.ProductOrderByWithRelationInput {
  switch (sort) {
    case "price-low":
      return { salePrice: "asc" };
    case "price-high":
      return { salePrice: "desc" };
    default:
      return { createdAt: "desc" };
  }
}

type RankedProductRow = {
  id: string;
  rating: number;
  reviewCount: number;
  total: number;
};

async function rankedProductPage(
  query: ProductQueryInput,
  categoryIds: string[] | undefined,
  publicOnly: boolean,
): Promise<{ ids: string[]; total: number; page: number }> {
  if (categoryIds?.length === 0) return { ids: [], total: 0, page: 1 };

  const conditions: Prisma.Sql[] = [];
  if (query.search) {
    const pattern = `%${query.search}%`;
    conditions.push(Prisma.sql`(
      p.name ILIKE ${pattern}
      OR p."productCode" ILIKE ${pattern}
      OR p."modelNumber" ILIKE ${pattern}
      OR p.series ILIKE ${pattern}
      OR EXISTS (
        SELECT 1 FROM "Category" category
        WHERE category.id = p."categoryId"
          AND (category.name ILIKE ${pattern} OR category.path ILIKE ${pattern})
      )
      OR EXISTS (
        SELECT 1 FROM "Brand" brand
        WHERE brand.id = p."brandId" AND brand.name ILIKE ${pattern}
      )
      OR EXISTS (
        SELECT 1 FROM "Manufacturer" manufacturer
        WHERE manufacturer.id = p."manufacturerId"
          AND manufacturer.name ILIKE ${pattern}
      )
      OR EXISTS (
        SELECT 1 FROM "ProductVariant" variant
        WHERE variant."productId" = p.id
          AND (variant.sku ILIKE ${pattern} OR variant."modelNumber" ILIKE ${pattern})
      )
    )`);
  }
  if (categoryIds) {
    conditions.push(
      Prisma.sql`p."categoryId" IN (${Prisma.join(categoryIds)})`,
    );
  }
  if (publicOnly) {
    conditions.push(Prisma.sql`p.status = 'ACTIVE'::"ProductStatus"`);
  } else if (query.status) {
    conditions.push(Prisma.sql`p.status = ${query.status}::"ProductStatus"`);
  }
  if (query.brandId) {
    conditions.push(Prisma.sql`p."brandId" = ${query.brandId}`);
    if (publicOnly) {
      conditions.push(Prisma.sql`EXISTS (
        SELECT 1 FROM "Brand" brand
        WHERE brand.id = p."brandId" AND brand.status = 'ACTIVE'::"BrandStatus"
      )`);
    }
  }
  if (query.brandSlug) {
    conditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM "Brand" brand
      WHERE brand.id = p."brandId"
        AND brand.slug = ${query.brandSlug}
        ${publicOnly ? Prisma.sql`AND brand.status = 'ACTIVE'::"BrandStatus"` : Prisma.empty}
    )`);
  }
  if (query.manufacturerId) {
    conditions.push(Prisma.sql`p."manufacturerId" = ${query.manufacturerId}`);
    if (publicOnly) {
      conditions.push(Prisma.sql`EXISTS (
        SELECT 1 FROM "Manufacturer" manufacturer
        WHERE manufacturer.id = p."manufacturerId"
          AND manufacturer.status = 'ACTIVE'::"ManufacturerStatus"
      )`);
    }
  }
  if (query.manufacturerSlug) {
    conditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM "Manufacturer" manufacturer
      WHERE manufacturer.id = p."manufacturerId"
        AND manufacturer.slug = ${query.manufacturerSlug}
        ${publicOnly ? Prisma.sql`AND manufacturer.status = 'ACTIVE'::"ManufacturerStatus"` : Prisma.empty}
    )`);
  }
  if (query.stock === "in-stock") {
    conditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM "ProductVariant" variant
      WHERE variant."productId" = p.id AND variant."isActive" = TRUE AND variant.stock > 0
    )`);
  } else if (query.stock === "out-of-stock") {
    conditions.push(Prisma.sql`NOT EXISTS (
      SELECT 1 FROM "ProductVariant" variant
      WHERE variant."productId" = p.id AND variant."isActive" = TRUE AND variant.stock > 0
    )`);
  }
  if (query.minPrice != null || query.maxPrice != null) {
    const discountRange: Prisma.Sql[] = [
      Prisma.sql`p."discountPrice" IS NOT NULL`,
    ];
    const saleRange: Prisma.Sql[] = [Prisma.sql`p."discountPrice" IS NULL`];
    if (query.minPrice != null) {
      discountRange.push(Prisma.sql`p."discountPrice" >= ${query.minPrice}`);
      saleRange.push(Prisma.sql`p."salePrice" >= ${query.minPrice}`);
    }
    if (query.maxPrice != null) {
      discountRange.push(Prisma.sql`p."discountPrice" <= ${query.maxPrice}`);
      saleRange.push(Prisma.sql`p."salePrice" <= ${query.maxPrice}`);
    }
    conditions.push(
      Prisma.sql`((${Prisma.join(discountRange, " AND ")}) OR (${Prisma.join(saleRange, " AND ")}))`,
    );
  }

  const whereSql =
    conditions.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
      : Prisma.empty;

  const orderBy =
    query.sort === "rating"
      ? Prisma.sql`rating DESC, "reviewCount" DESC, id ASC`
      : query.sort === "popular"
        ? Prisma.sql`"reviewCount" DESC, rating DESC, id ASC`
        : query.sort === "price-low"
          ? Prisma.sql`"effectivePrice" ASC, id ASC`
          : query.sort === "price-high"
            ? Prisma.sql`"effectivePrice" DESC, id ASC`
            : Prisma.sql`"createdAt" DESC, id ASC`;
  const minimumRating = query.minRating ?? 0;
  const readPage = (offset: number, limit = query.pageSize) =>
    prisma.$queryRaw<RankedProductRow[]>(Prisma.sql`
      WITH metrics AS (
        SELECT
          p.id,
          p."createdAt",
          p."salePrice",
          CASE
            WHEN p."discountPrice" IS NOT NULL
              AND p."discountPrice" < p."salePrice"
            THEN p."discountPrice"
            ELSE p."salePrice"
          END AS "effectivePrice",
          COALESCE(AVG(r.rating), 0)::double precision AS rating,
          COUNT(r.id)::integer AS "reviewCount"
        FROM "Product" p
        LEFT JOIN "Review" r ON r."productId" = p.id
        ${whereSql}
        GROUP BY p.id, p."createdAt", p."salePrice", p."discountPrice"
      ), filtered AS (
        SELECT *, COUNT(*) OVER()::integer AS total
        FROM metrics
        WHERE rating >= ${minimumRating}
      )
      SELECT id, rating, "reviewCount", total
      FROM filtered
      ORDER BY ${orderBy}
      LIMIT ${limit}
      OFFSET ${offset}
    `);

  let page = query.page;
  let rows = await readPage((page - 1) * query.pageSize);
  let total = Number(rows[0]?.total ?? 0);

  if (rows.length === 0 && page > 1) {
    const firstRow = await readPage(0, 1);
    total = Number(firstRow[0]?.total ?? 0);
    page = Math.min(page, Math.max(1, Math.ceil(total / query.pageSize)));
    rows = total > 0 ? await readPage((page - 1) * query.pageSize) : [];
  }

  return {
    ids: rows.map((row) => row.id),
    total,
    page,
  };
}

export async function listProducts(
  query: ProductQueryInput,
  options: ListProductsOptions = {},
) {
  const publicOnly = options.publicOnly ?? true;
  const categoryIds = await resolveCategoryIds(query, publicOnly);
  const where = buildWhere(query, categoryIds, publicOnly);
  const skip = (query.page - 1) * query.pageSize;
  const aggregateSort = query.minRating != null || query.sort !== "latest";

  let rows: ProductRow[];
  let total: number;
  let page = query.page;
  if (aggregateSort) {
    const ranked = await rankedProductPage(query, categoryIds, publicOnly);
    total = ranked.total;
    page = ranked.page;
    if (ranked.ids.length === 0) {
      rows = [];
    } else {
      const hydrated = await prisma.product.findMany({
        where: { id: { in: ranked.ids } },
        include: productInclude,
      });
      const byId = new Map(hydrated.map((row) => [row.id, row]));
      rows = ranked.ids.flatMap((id) => {
        const row = byId.get(id);
        return row ? [row] : [];
      });
    }
  } else {
    [rows, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: buildOrderBy(query.sort),
        skip,
        take: query.pageSize,
        include: productInclude,
      }),
      prisma.product.count({ where }),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
    page = Math.min(query.page, totalPages);
    if (total > 0 && page !== query.page) {
      rows = await prisma.product.findMany({
        where,
        orderBy: buildOrderBy(query.sort),
        skip: (page - 1) * query.pageSize,
        take: query.pageSize,
        include: productInclude,
      });
    }
  }

  return {
    items: await withBreadcrumbs(rows),
    meta: {
      page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  };
}

async function hydrateOne(
  row: ProductRow | null,
): Promise<ProductWithCategory | null> {
  if (!row) return null;
  return (await withBreadcrumbs([row]))[0] ?? null;
}

export async function getProductById(id: string) {
  return hydrateOne(
    await prisma.product.findUnique({ where: { id }, include: productInclude }),
  );
}

export async function getActiveProductById(id: string) {
  const row = await prisma.product.findFirst({
    where: { id, status: "ACTIVE" },
    include: productInclude,
  });
  if (!row || !(await isCategoryEffectivelyActive(row.categoryId))) {
    return null;
  }
  return (await withBreadcrumbs([row]))[0] ?? null;
}

export async function getProductBySlug(slug: string) {
  const normalizedSlug = slug.trim().toLowerCase();
  return hydrateOne(
    await prisma.product.findUnique({
      where: { slug: normalizedSlug },
      include: productInclude,
    }),
  );
}

export function getProductRedirectBySlug(
  slug: string,
): Promise<CatalogRedirectDto<"PRODUCT"> | null> {
  const sourcePath = catalogRoutePath("products", slug.toLowerCase());
  return sourcePath
    ? getCatalogRedirectByPath(sourcePath, "PRODUCT")
    : Promise.resolve(null);
}

export async function getActiveProductBySlug(slug: string) {
  const normalizedSlug = slug.trim().toLowerCase();
  const row = await prisma.product.findFirst({
    where: { slug: normalizedSlug, status: "ACTIVE" },
    include: productInclude,
  });
  if (!row || !(await isCategoryEffectivelyActive(row.categoryId))) {
    return null;
  }
  return (await withBreadcrumbs([row]))[0] ?? null;
}

export async function getProductSlugById(id: string): Promise<string | null> {
  const product = await getActiveProductById(id);
  return product?.slug ?? null;
}

function normalizeSku(sku: string | null | undefined): string | null {
  return sku?.trim() || null;
}

function nullableJson(
  value: unknown,
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return value == null ? Prisma.DbNull : (value as Prisma.InputJsonValue);
}

function variantData(variant: ProductVariantInput) {
  const attributes = cleanVariantAttributes(variant.attributes);
  return {
    variantKey: deriveVariantKey({
      size: variant.size,
      color: variant.color,
      attributes,
    }),
    name: variant.name ?? null,
    size: variant.size ?? null,
    color: variant.color ?? null,
    modelNumber: variant.modelNumber ?? null,
    sku: normalizeSku(variant.sku),
    stock: variant.stock,
    image: variant.image ?? null,
    attributes: nullableJson(attributes),
    isActive: variant.isActive,
  };
}

function validatedVariantData(
  variant: ProductVariantInput,
  index: number,
  storedColor?: { value: string | null },
) {
  const color = resolveProductColorWrite(variant.color, storedColor);
  if (!color.success) {
    const message = `Variant ${index + 1} color: ${color.message}`;
    throw new ProductError(400, message, {
      fieldErrors: { variants: [message] },
    });
  }

  return variantData({ ...variant, color: color.value });
}

async function assertReferences(
  client: Prisma.TransactionClient,
  input: {
    categoryId?: string;
    brandId?: string | null;
    manufacturerId?: string | null;
  },
) {
  const [category, brand, manufacturer] = await Promise.all([
    input.categoryId
      ? client.category.findUnique({
          where: { id: input.categoryId },
          select: { id: true },
        })
      : null,
    input.brandId
      ? client.brand.findUnique({
          where: { id: input.brandId },
          select: { id: true, status: true },
        })
      : null,
    input.manufacturerId
      ? client.manufacturer.findUnique({
          where: { id: input.manufacturerId },
          select: { id: true, status: true },
        })
      : null,
  ]);
  if (input.categoryId && !category) {
    throw new ProductError(400, "Selected category does not exist.", {
      fieldErrors: { categoryId: ["Select a valid category."] },
    });
  }
  if (input.brandId && (!brand || brand.status !== "ACTIVE")) {
    throw new ProductError(400, "Selected brand is not active.", {
      fieldErrors: { brandId: ["Select an active brand."] },
    });
  }
  if (
    input.manufacturerId &&
    (!manufacturer || manufacturer.status !== "ACTIVE")
  ) {
    throw new ProductError(400, "Selected manufacturer is not active.", {
      fieldErrors: { manufacturerId: ["Select an active manufacturer."] },
    });
  }
}

function uniqueImages(input: { image?: string | null; images?: string[] }) {
  return Array.from(
    new Set([...(input.image ? [input.image] : []), ...(input.images ?? [])]),
  );
}

function productImageAlt(
  productName: string,
  position: number,
  primaryImageAlt?: string | null,
): string {
  if (position === 0) {
    return cleanOptionalText(primaryImageAlt) ?? productName;
  }
  return `${productName} image ${position + 1}`;
}

export async function createProduct(input: CreateProductInput) {
  const slug = await uniqueSlug(input.name);
  const images = uniqueImages(input);
  const variants = input.variants.map((variant, index) =>
    validatedVariantData(variant, index),
  );
  const MAX_ATTEMPTS = 5;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const productCode = await nextProductCode();
    try {
      const row = await prisma.$transaction(async (tx) => {
        await assertReferences(tx, input);
        const created = await tx.product.create({
          data: {
            productCode,
            name: input.name,
            slug,
            description: input.description ?? null,
            seoTitle: cleanOptionalText(input.seoTitle) ?? null,
            metaDescription: cleanOptionalText(input.metaDescription) ?? null,
            ogImage: cleanOptionalText(input.ogImage) ?? null,
            gtin: cleanOptionalText(input.gtin) ?? null,
            itemCondition: input.itemCondition,
            modelNumber: input.modelNumber ?? null,
            series: input.series ?? null,
            specifications: nullableJson(input.specifications),
            descriptionBlocks: nullableJson(input.descriptionBlocks ?? null),
            status: input.status,
            categoryId: input.categoryId,
            brandId: input.brandId ?? null,
            manufacturerId: input.manufacturerId ?? null,
            buyingPrice: input.buyingPrice,
            salePrice: input.salePrice,
            discountPrice: input.discountPrice ?? null,
            variants: { create: variants },
            images: {
              create: images.map((url, position) => ({
                url,
                alt: productImageAlt(
                  input.name,
                  position,
                  input.primaryImageAlt,
                ),
                position,
              })),
            },
          },
          include: productInclude,
        });

        await releaseCatalogRedirectSources(tx, [`/products/${slug}`]);

        const stockLogs = created.variants
          .filter((variant) => variant.stock !== 0)
          .map((variant) => ({
            variantId: variant.id,
            type: "MANUAL_ADJUSTMENT" as const,
            quantity: variant.stock,
            note: "Initial product stock",
          }));
        if (stockLogs.length > 0) {
          await tx.inventoryLog.createMany({ data: stockLogs });
        }
        return created;
      });
      return hydrateOne(row).then((product) => product!);
    } catch (error) {
      const target =
        error instanceof PrismaClientKnownRequestError
          ? ((error.meta?.target as string[] | undefined) ?? [])
          : [];
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        target.includes("productCode") &&
        attempt < MAX_ATTEMPTS - 1
      ) {
        continue;
      }
      throw error;
    }
  }
  throw new Error("Failed to generate a unique product code.");
}

export async function updateProduct(id: string, input: UpdateProductInput) {
  const row = await prisma.$transaction(async (tx) => {
    const lockedProducts = await tx.$queryRaw<
      Array<{ id: string; name: string; slug: string }>
    >(
      Prisma.sql`SELECT "id", "name", "slug" FROM "Product" WHERE "id" = ${id} FOR UPDATE`,
    );
    if (lockedProducts.length === 0) {
      throw new ProductError(404, "Product not found.");
    }
    const productName = input.name ?? lockedProducts[0].name;
    const previousSlug = lockedProducts[0].slug;
    const nextSlug = input.slug ?? previousSlug;

    if (nextSlug !== previousSlug) {
      const slugConflict = await tx.product.findUnique({
        where: { slug: nextSlug },
        select: { id: true },
      });
      if (slugConflict && slugConflict.id !== id) {
        throw new ProductError(409, "Product slug is already in use.", {
          fieldErrors: { slug: ["Choose a unique product slug."] },
        });
      }
    }

    await assertReferences(tx, {
      categoryId: input.categoryId,
      brandId: input.brandId,
      manufacturerId: input.manufacturerId,
    });

    const data: Prisma.ProductUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.slug !== undefined) data.slug = input.slug;
    if (input.description !== undefined) data.description = input.description;
    if (input.seoTitle !== undefined) {
      data.seoTitle = cleanOptionalText(input.seoTitle);
    }
    if (input.metaDescription !== undefined) {
      data.metaDescription = cleanOptionalText(input.metaDescription);
    }
    if (input.ogImage !== undefined) {
      data.ogImage = cleanOptionalText(input.ogImage);
    }
    if (input.gtin !== undefined) data.gtin = cleanOptionalText(input.gtin);
    if (input.itemCondition !== undefined) {
      data.itemCondition = input.itemCondition;
    }
    if (input.modelNumber !== undefined) data.modelNumber = input.modelNumber;
    if (input.series !== undefined) data.series = input.series;
    if (input.specifications !== undefined) {
      data.specifications = nullableJson(input.specifications);
    }
    if (input.descriptionBlocks !== undefined) {
      data.descriptionBlocks = nullableJson(input.descriptionBlocks ?? null);
    }
    if (input.status !== undefined) data.status = input.status;
    if (input.categoryId !== undefined) {
      data.category = { connect: { id: input.categoryId } };
    }
    if (input.brandId !== undefined) {
      data.brand = input.brandId
        ? { connect: { id: input.brandId } }
        : { disconnect: true };
    }
    if (input.manufacturerId !== undefined) {
      data.manufacturer = input.manufacturerId
        ? { connect: { id: input.manufacturerId } }
        : { disconnect: true };
    }
    if (input.buyingPrice !== undefined) data.buyingPrice = input.buyingPrice;
    if (input.salePrice !== undefined) data.salePrice = input.salePrice;
    if (input.discountPrice !== undefined)
      data.discountPrice = input.discountPrice;
    await tx.product.update({ where: { id }, data });

    if (nextSlug !== previousSlug) {
      await recordCatalogRedirectMoves(tx, "PRODUCT", [
        {
          entityId: id,
          sourcePath: `/products/${previousSlug}`,
          destinationPath: `/products/${nextSlug}`,
        },
      ]);
    }

    if (input.variants !== undefined) {
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "ProductVariant" WHERE "productId" = ${id} ORDER BY "id" FOR UPDATE`,
      );
      const existing = await tx.productVariant.findMany({
        where: { productId: id },
        select: { id: true, stock: true, color: true },
      });
      const existingById = new Map(
        existing.map((variant) => [variant.id, variant]),
      );
      const keptIds = new Set<string>();

      for (const [index, variant] of input.variants.entries()) {
        if (variant.id) {
          const previous = existingById.get(variant.id);
          if (!previous) {
            throw new ProductError(
              400,
              "A variant does not belong to this product.",
              {
                fieldErrors: {
                  variants: ["Refresh the product and try again."],
                },
              },
            );
          }
          const next = validatedVariantData(variant, index, {
            value: previous.color,
          });
          keptIds.add(variant.id);
          await tx.productVariant.update({
            where: { id: variant.id },
            data: next,
          });
          const delta = next.stock - previous.stock;
          if (delta !== 0) {
            await tx.inventoryLog.create({
              data: {
                variantId: variant.id,
                type: "MANUAL_ADJUSTMENT",
                quantity: delta,
                note: "Stock changed from product editor",
              },
            });
          }
        } else {
          const next = validatedVariantData(variant, index);
          const created = await tx.productVariant.create({
            data: { productId: id, ...next },
            select: { id: true },
          });
          if (next.stock !== 0) {
            await tx.inventoryLog.create({
              data: {
                variantId: created.id,
                type: "MANUAL_ADJUSTMENT",
                quantity: next.stock,
                note: "Initial variant stock",
              },
            });
          }
        }
      }

      const removedIds = [...existingById.keys()].filter(
        (variantId) => !keptIds.has(variantId),
      );
      if (removedIds.length > 0) {
        await tx.productVariant.deleteMany({
          where: { id: { in: removedIds } },
        });
      }
    }

    if (input.image !== undefined || input.images !== undefined) {
      const images = uniqueImages(input);
      await tx.productImage.deleteMany({ where: { productId: id } });
      if (images.length > 0) {
        await tx.productImage.createMany({
          data: images.map((url, position) => ({
            productId: id,
            url,
            alt: productImageAlt(productName, position, input.primaryImageAlt),
            position,
          })),
        });
      }
    } else if (input.primaryImageAlt !== undefined) {
      const primaryImage = await tx.productImage.findFirst({
        where: { productId: id },
        orderBy: [{ position: "asc" }, { id: "asc" }],
        select: { id: true },
      });
      if (primaryImage) {
        await tx.productImage.update({
          where: { id: primaryImage.id },
          data: { alt: productImageAlt(productName, 0, input.primaryImageAlt) },
        });
      }
    }

    return tx.product.findUniqueOrThrow({
      where: { id },
      include: productInclude,
    });
  });

  return hydrateOne(row).then((product) => product!);
}

export async function softDeleteProduct(id: string) {
  const row = await prisma.product.update({
    where: { id },
    data: { status: "INACTIVE" },
    include: productInclude,
  });
  return hydrateOne(row).then((product) => product!);
}

export function hardDeleteProduct(id: string) {
  return prisma.$transaction(async (tx) => {
    const deleted = await tx.product.delete({ where: { id } });
    await deleteCatalogRedirectsForEntity(tx, "PRODUCT", id);
    return deleted;
  });
}
