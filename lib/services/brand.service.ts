import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import { unstable_cache } from "next/cache";

import {
  cleanOptionalText,
  slugifyCatalogName,
} from "@/lib/catalog/catalog-entity";
import { catalogCacheTags } from "@/lib/cache/catalog-tags";
import { prisma } from "@/lib/db/prisma";
import { getEffectiveActiveCategoryIds } from "@/lib/services/category.service";
import {
  catalogRoutePath,
  deleteCatalogRedirectsForEntity,
  getCatalogRedirectByPath,
  recordCatalogRedirectMoves,
  releaseCatalogRedirectSources,
  type CatalogRedirectDto,
} from "@/lib/services/catalog-redirect.service";
import { ServiceError } from "@/lib/services/service-error";
import type {
  BrandQueryInput,
  CreateBrandInput,
  UpdateBrandInput,
} from "@/lib/validations/brand.validation";

const brandSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  logo: true,
  website: true,
  seoTitle: true,
  metaDescription: true,
  ogImage: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { products: true } },
} satisfies Prisma.BrandSelect;

type BrandRow = Prisma.BrandGetPayload<{ select: typeof brandSelect }>;

export type SerializedBrand = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo: string | null;
  website: string | null;
  seoTitle: string | null;
  metaDescription: string | null;
  ogImage: string | null;
  status: "ACTIVE" | "INACTIVE";
  productCount: number;
  createdAt: string;
  updatedAt: string;
};

function serializeBrand(row: BrandRow): SerializedBrand {
  const { _count, ...brand } = row;
  return {
    ...brand,
    productCount: _count.products,
    createdAt: brand.createdAt.toISOString(),
    updatedAt: brand.updatedAt.toISOString(),
  };
}

function buildWhere(query: BrandQueryInput): Prisma.BrandWhereInput {
  const where: Prisma.BrandWhereInput = {};
  if (query.status) where.status = query.status;
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { slug: { contains: query.search, mode: "insensitive" } },
      { description: { contains: query.search, mode: "insensitive" } },
      { seoTitle: { contains: query.search, mode: "insensitive" } },
      { metaDescription: { contains: query.search, mode: "insensitive" } },
      { website: { contains: query.search, mode: "insensitive" } },
    ];
  }
  return where;
}

function buildOrderBy(
  sort: BrandQueryInput["sort"],
): Prisma.BrandOrderByWithRelationInput[] {
  switch (sort) {
    case "latest":
      return [{ createdAt: "desc" }, { name: "asc" }];
    case "oldest":
      return [{ createdAt: "asc" }, { name: "asc" }];
    case "name":
    default:
      return [{ name: "asc" }, { createdAt: "asc" }];
  }
}

export async function listBrands(query: BrandQueryInput) {
  const where = buildWhere(query);
  const skip = (query.page - 1) * query.pageSize;
  const [rows, total] = await Promise.all([
    prisma.brand.findMany({
      where,
      orderBy: buildOrderBy(query.sort),
      skip,
      take: query.pageSize,
      select: brandSelect,
    }),
    prisma.brand.count({ where }),
  ]);

  return {
    items: rows.map(serializeBrand),
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  };
}

export async function getBrandById(
  id: string,
): Promise<SerializedBrand | null> {
  const row = await prisma.brand.findUnique({
    where: { id },
    select: brandSelect,
  });
  return row ? serializeBrand(row) : null;
}

const PUBLIC_BRAND_CACHE_SECONDS = 1800;
const PUBLIC_BRAND_PRODUCT_LIMIT = 48;

export type PublicBrandSummary = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo: string | null;
  seoTitle: string | null;
  metaDescription: string | null;
  ogImage: string | null;
  productCount: number;
};

export type PublicBrandProduct = {
  id: string;
  productCode: string;
  slug: string;
  name: string;
  price: number;
  discountPrice: number | null;
  image: string | null;
  variantCount: number;
  inStock: boolean;
  rating: number;
  reviewCount: number;
};

export type PublicBrand = PublicBrandSummary & {
  website: string | null;
  products: PublicBrandProduct[];
};

const publicBrandSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  logo: true,
  website: true,
  seoTitle: true,
  metaDescription: true,
  ogImage: true,
} satisfies Prisma.BrandSelect;

async function loadPublicBrands(): Promise<PublicBrandSummary[]> {
  const activeCategoryIds = [...(await getEffectiveActiveCategoryIds())];
  const brands = await prisma.brand.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ name: "asc" }, { createdAt: "asc" }],
    select: {
      ...publicBrandSelect,
      _count: {
        select: {
          products: {
            where: {
              status: "ACTIVE",
              categoryId: { in: activeCategoryIds },
            },
          },
        },
      },
    },
  });

  return brands.map((brand) => ({
    id: brand.id,
    name: brand.name,
    slug: brand.slug,
    description: brand.description,
    logo: brand.logo,
    seoTitle: brand.seoTitle,
    metaDescription: brand.metaDescription,
    ogImage: brand.ogImage,
    productCount: brand._count.products,
  }));
}

const getCachedPublicBrands = unstable_cache(
  loadPublicBrands,
  ["public-brand-directory-v1"],
  {
    revalidate: PUBLIC_BRAND_CACHE_SECONDS,
    tags: [catalogCacheTags.brandDirectory],
  },
);

export function getPublicBrands(): Promise<PublicBrandSummary[]> {
  return getCachedPublicBrands();
}

async function loadPublicBrandBySlug(
  slug: string,
): Promise<PublicBrand | null> {
  const normalizedSlug = slug.trim();
  if (!normalizedSlug) return null;

  const brand = await prisma.brand.findFirst({
    where: { slug: normalizedSlug, status: "ACTIVE" },
    select: publicBrandSelect,
  });
  if (!brand) return null;

  const activeCategoryIds = [...(await getEffectiveActiveCategoryIds())];
  const productWhere = {
    brandId: brand.id,
    status: "ACTIVE" as const,
    categoryId: { in: activeCategoryIds },
  };
  const [products, productCount] = await Promise.all([
    prisma.product.findMany({
      where: productWhere,
      orderBy: [{ createdAt: "desc" }, { name: "asc" }],
      take: PUBLIC_BRAND_PRODUCT_LIMIT,
      select: {
        id: true,
        slug: true,
        name: true,
        productCode: true,
        salePrice: true,
        discountPrice: true,
        images: {
          orderBy: { position: "asc" },
          take: 1,
          select: { url: true },
        },
        variants: {
          where: { isActive: true },
          select: { id: true, stock: true },
        },
        reviews: { select: { rating: true } },
      },
    }),
    prisma.product.count({ where: productWhere }),
  ]);

  return {
    ...brand,
    productCount,
    products: products.map((product) => {
      const price = product.salePrice.toNumber();
      const candidateDiscount = product.discountPrice?.toNumber() ?? null;
      const reviewCount = product.reviews.length;
      return {
        id: product.id,
        productCode: product.productCode,
        slug: product.slug,
        name: product.name,
        price,
        discountPrice:
          candidateDiscount !== null && candidateDiscount < price
            ? candidateDiscount
            : null,
        image: product.images[0]?.url ?? null,
        variantCount: product.variants.length,
        inStock: product.variants.some((variant) => variant.stock > 0),
        rating:
          reviewCount > 0
            ? product.reviews.reduce((sum, review) => sum + review.rating, 0) /
              reviewCount
            : 0,
        reviewCount,
      };
    }),
  };
}

export function getPublicBrandBySlug(
  slug: string,
): Promise<PublicBrand | null> {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!normalizedSlug) return Promise.resolve(null);

  return unstable_cache(
    () => loadPublicBrandBySlug(normalizedSlug),
    ["public-brand-by-slug-v3", normalizedSlug],
    {
      revalidate: PUBLIC_BRAND_CACHE_SECONDS,
      tags: [
        catalogCacheTags.brandSlug(normalizedSlug),
        catalogCacheTags.categoryTree,
      ],
    },
  )();
}

export function getBrandRedirectBySlug(
  slug: string,
): Promise<CatalogRedirectDto<"BRAND"> | null> {
  const sourcePath = catalogRoutePath("brands", slug.toLowerCase());
  return sourcePath
    ? getCatalogRedirectByPath(sourcePath, "BRAND")
    : Promise.resolve(null);
}

async function assertUniqueBrandName(name: string, excludeId?: string) {
  const conflict = await prisma.brand.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (conflict) {
    throw new ServiceError(409, "A brand with that name already exists.");
  }
}

async function generateUniqueBrandSlug(name: string): Promise<string> {
  const root = slugifyCatalogName(name, "brand");
  let candidate = root;

  for (let suffix = 2; suffix <= 51; suffix += 1) {
    const conflict = await prisma.brand.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!conflict) return candidate;
    candidate = `${root}-${suffix}`;
  }

  return `${root}-${Date.now()}`;
}

function mapBrandWriteError(error: unknown): never {
  if (error instanceof ServiceError) throw error;
  if (error instanceof PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      throw new ServiceError(404, "Brand not found.");
    }
    if (error.code === "P2002") {
      throw new ServiceError(409, "A brand with that name already exists.");
    }
  }
  throw error;
}

export async function createBrand(input: CreateBrandInput) {
  await assertUniqueBrandName(input.name);
  const slug = await generateUniqueBrandSlug(input.name);

  try {
    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.brand.create({
        data: {
          name: input.name,
          slug,
          description: cleanOptionalText(input.description) ?? null,
          logo: cleanOptionalText(input.logo) ?? null,
          website: cleanOptionalText(input.website) ?? null,
          seoTitle: cleanOptionalText(input.seoTitle) ?? null,
          metaDescription: cleanOptionalText(input.metaDescription) ?? null,
          ogImage: cleanOptionalText(input.ogImage) ?? null,
          status: input.status,
        },
        select: brandSelect,
      });
      await releaseCatalogRedirectSources(tx, [`/brands/${slug}`]);
      return created;
    });
    return serializeBrand(row);
  } catch (error) {
    return mapBrandWriteError(error);
  }
}

export async function updateBrand(id: string, input: UpdateBrandInput) {
  if (input.name !== undefined) {
    await assertUniqueBrandName(input.name, id);
  }

  const data: Prisma.BrandUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.slug !== undefined) data.slug = input.slug;
  if (input.description !== undefined) {
    data.description = cleanOptionalText(input.description);
  }
  if (input.logo !== undefined) data.logo = cleanOptionalText(input.logo);
  if (input.website !== undefined) {
    data.website = cleanOptionalText(input.website);
  }
  if (input.seoTitle !== undefined) {
    data.seoTitle = cleanOptionalText(input.seoTitle);
  }
  if (input.metaDescription !== undefined) {
    data.metaDescription = cleanOptionalText(input.metaDescription);
  }
  if (input.ogImage !== undefined) {
    data.ogImage = cleanOptionalText(input.ogImage);
  }
  if (input.status !== undefined) data.status = input.status;

  try {
    if (input.slug !== undefined) {
      const row = await prisma.$transaction(async (tx) => {
        const lockedBrands = await tx.$queryRaw<
          Array<{ id: string; slug: string }>
        >`SELECT "id", "slug" FROM "Brand" WHERE "id" = ${id} FOR UPDATE`;
        const existing = lockedBrands[0];
        if (!existing) throw new ServiceError(404, "Brand not found.");

        if (input.slug !== existing.slug) {
          const slugConflict = await tx.brand.findUnique({
            where: { slug: input.slug },
            select: { id: true },
          });
          if (slugConflict && slugConflict.id !== id) {
            throw new ServiceError(409, "Brand slug is already in use.", {
              fieldErrors: { slug: ["Choose a unique brand slug."] },
            });
          }
        }

        const updated = await tx.brand.update({
          where: { id },
          data,
          select: brandSelect,
        });

        if (input.slug !== existing.slug) {
          await recordCatalogRedirectMoves(tx, "BRAND", [
            {
              entityId: id,
              sourcePath: `/brands/${existing.slug}`,
              destinationPath: `/brands/${input.slug}`,
            },
          ]);
        }
        return updated;
      });
      return serializeBrand(row);
    }

    const row = await prisma.brand.update({
      where: { id },
      data,
      select: brandSelect,
    });
    return serializeBrand(row);
  } catch (error) {
    return mapBrandWriteError(error);
  }
}

export async function deleteBrand(id: string): Promise<{ id: string }> {
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.brand.findUnique({
        where: { id },
        select: { id: true, _count: { select: { products: true } } },
      });
      if (!existing) throw new ServiceError(404, "Brand not found.");
      if (existing._count.products > 0) {
        throw new ServiceError(
          409,
          `Cannot delete this brand while ${existing._count.products} product${existing._count.products === 1 ? "" : "s"} reference it.`,
          { productCount: existing._count.products },
        );
      }

      await tx.brand.delete({ where: { id } });
      await deleteCatalogRedirectsForEntity(tx, "BRAND", id);
      return { id };
    });
  } catch (error) {
    return mapBrandWriteError(error);
  }
}
