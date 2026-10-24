import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";
import { unstable_cache } from "next/cache";

import { catalogCacheTags } from "@/lib/cache/catalog-tags";
import { cleanOptionalText } from "@/lib/catalog/catalog-entity";
import { prisma } from "@/lib/db/prisma";
import {
  catalogRoutePath,
  deleteCatalogRedirectsForEntity,
  getCatalogRedirectByPath,
  releaseCatalogRedirectSources,
} from "@/lib/services/catalog-redirect.service";
import { ServiceError } from "@/lib/services/service-error";
import type {
  CategoryQueryInput,
  CreateCategoryInput,
  ReorderCategoriesInput,
  UpdateCategoryInput,
} from "@/lib/validations/category.validation";

const CATEGORY_CACHE_SECONDS = 1800;
const CATEGORY_LANDING_PRODUCT_LIMIT = 40;
const CATEGORY_TREE_LOCK_KEY = "bangbuy:category-tree:v1";

const categoryRecordSelect = {
  id: true,
  name: true,
  slug: true,
  path: true,
  description: true,
  image: true,
  seoTitle: true,
  metaDescription: true,
  ogImage: true,
  status: true,
  position: true,
  depth: true,
  parentId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CategorySelect;

type CategoryRecord = Prisma.CategoryGetPayload<{
  select: typeof categoryRecordSelect;
}>;

export type CategoryBreadcrumb = Pick<
  CategoryRecord,
  "id" | "name" | "slug" | "path"
>;

export type CategoryDto = CategoryRecord & {
  parent: CategoryBreadcrumb | null;
  breadcrumb: CategoryBreadcrumb[];
  childCount: number;
  directProductCount: number;
  totalProductCount: number;
  /** Compatibility alias for the original admin category table. */
  productCount: number;
  effectiveActive: boolean;
  children?: CategoryDto[];
};

/** Compatibility aliases retained for existing server/UI imports. */
export type Category = CategoryDto;
export type CategoryWithProductCount = CategoryDto;

export type CategoryServiceErrorCode =
  | "CATEGORY_NOT_FOUND"
  | "PARENT_NOT_FOUND"
  | "SELF_PARENT"
  | "CATEGORY_CYCLE"
  | "PATH_CONFLICT"
  | "INVALID_POSITION"
  | "INVALID_REORDER"
  | "DELETE_CONFLICT";

export class CategoryServiceError extends ServiceError {
  constructor(
    public readonly code: CategoryServiceErrorCode,
    message: string,
    status: 400 | 404 | 409,
    details?: Record<string, unknown>,
  ) {
    super(status, message, details);
    this.name = "CategoryServiceError";
  }
}

type CategoryGraph = {
  records: CategoryRecord[];
  recordById: Map<string, CategoryRecord>;
  dtoById: Map<string, CategoryDto>;
  effectiveActiveIds: Set<string>;
};

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeCategoryPath(path: string): string {
  return path
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "");
}

function categoryRoutePath(path: string): string {
  return `/categories/${normalizeCategoryPath(path)}`;
}

export type CategoryRedirectDto = {
  sourcePath: string;
  destinationPath: string;
  entityType: "CATEGORY";
  entityId: string;
  permanent: boolean;
};

/**
 * Resolve an old category URL recorded during a hierarchy move. The input may
 * be either a category-relative path or a full `/categories/...` path.
 */
export function getCategoryRedirectByPath(
  path: string,
): Promise<CategoryRedirectDto | null> {
  const sourcePath = catalogRoutePath("categories", path);
  return sourcePath
    ? getCatalogRedirectByPath(sourcePath, "CATEGORY")
    : Promise.resolve(null);
}

export function isCategoryPathInSubtree(
  candidatePath: string,
  rootPath: string,
): boolean {
  return candidatePath === rootPath || candidatePath.startsWith(`${rootPath}/`);
}

function toBreadcrumb(record: CategoryRecord): CategoryBreadcrumb {
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    path: record.path,
  };
}

function computeEffectiveActiveIds(
  records: CategoryRecord[],
  recordById: ReadonlyMap<string, CategoryRecord>,
): Set<string> {
  const visibility = new Map<string, boolean>();

  for (const start of records) {
    if (visibility.has(start.id)) continue;

    const chain: string[] = [];
    const seen = new Set<string>();
    let current: CategoryRecord | undefined = start;
    let isVisible = false;

    while (current) {
      const known = visibility.get(current.id);
      if (known !== undefined) {
        isVisible = known;
        break;
      }

      if (seen.has(current.id)) {
        isVisible = false;
        break;
      }

      seen.add(current.id);
      chain.push(current.id);

      if (current.status !== "ACTIVE") {
        isVisible = false;
        break;
      }

      if (current.parentId === null) {
        isVisible = true;
        break;
      }

      current = recordById.get(current.parentId);
      if (!current) {
        isVisible = false;
        break;
      }
    }

    for (const id of chain) visibility.set(id, isVisible);
  }

  return new Set(
    [...visibility.entries()]
      .filter(([, isVisible]) => isVisible)
      .map(([id]) => id),
  );
}

function buildBreadcrumb(
  record: CategoryRecord,
  recordById: ReadonlyMap<string, CategoryRecord>,
): CategoryBreadcrumb[] {
  const result: CategoryBreadcrumb[] = [];
  const visited = new Set<string>([record.id]);
  let parentId = record.parentId;

  while (parentId) {
    if (visited.has(parentId)) break;
    visited.add(parentId);
    const parent = recordById.get(parentId);
    if (!parent) break;
    result.unshift(toBreadcrumb(parent));
    parentId = parent.parentId;
  }

  return result;
}

function buildCategoryGraph(
  records: CategoryRecord[],
  directProductCounts: ReadonlyMap<string, number>,
  effectiveActiveOnly: boolean,
): CategoryGraph {
  const recordById = new Map(records.map((record) => [record.id, record]));
  const effectiveActiveIds = computeEffectiveActiveIds(records, recordById);
  const eligible = (id: string) =>
    !effectiveActiveOnly || effectiveActiveIds.has(id);

  const childCounts = new Map<string, number>();
  for (const record of records) {
    if (!eligible(record.id) || record.parentId === null) continue;
    if (!eligible(record.parentId)) continue;
    childCounts.set(
      record.parentId,
      (childCounts.get(record.parentId) ?? 0) + 1,
    );
  }

  const totalProductCounts = new Map<string, number>();
  for (const record of records) {
    totalProductCounts.set(
      record.id,
      eligible(record.id) ? (directProductCounts.get(record.id) ?? 0) : 0,
    );
  }

  for (const record of [...records].sort((a, b) => b.depth - a.depth)) {
    if (!eligible(record.id) || record.parentId === null) continue;
    if (!eligible(record.parentId)) continue;
    totalProductCounts.set(
      record.parentId,
      (totalProductCounts.get(record.parentId) ?? 0) +
        (totalProductCounts.get(record.id) ?? 0),
    );
  }

  const dtoById = new Map<string, CategoryDto>();
  for (const record of records) {
    const parent = record.parentId
      ? recordById.get(record.parentId)
      : undefined;
    const directProductCount = eligible(record.id)
      ? (directProductCounts.get(record.id) ?? 0)
      : 0;

    dtoById.set(record.id, {
      ...record,
      parent: parent ? toBreadcrumb(parent) : null,
      breadcrumb: buildBreadcrumb(record, recordById),
      childCount: childCounts.get(record.id) ?? 0,
      directProductCount,
      totalProductCount: totalProductCounts.get(record.id) ?? 0,
      productCount: directProductCount,
      effectiveActive: effectiveActiveIds.has(record.id),
    });
  }

  return { records, recordById, dtoById, effectiveActiveIds };
}

async function loadCategoryGraph(options?: {
  activeProductsOnly?: boolean;
  effectiveActiveOnly?: boolean;
}): Promise<CategoryGraph> {
  const [records, productCounts] = await Promise.all([
    prisma.category.findMany({ select: categoryRecordSelect }),
    prisma.product.groupBy({
      by: ["categoryId"],
      where: options?.activeProductsOnly ? { status: "ACTIVE" } : undefined,
      _count: { _all: true },
    }),
  ]);

  const directCounts = new Map(
    productCounts.map((row) => [row.categoryId, row._count._all]),
  );

  return buildCategoryGraph(
    records,
    directCounts,
    options?.effectiveActiveOnly ?? false,
  );
}

function compareCategories(
  a: CategoryDto,
  b: CategoryDto,
  sort: CategoryQueryInput["sort"],
): number {
  switch (sort) {
    case "name":
      return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
    case "latest":
      return (
        b.createdAt.getTime() - a.createdAt.getTime() ||
        a.id.localeCompare(b.id)
      );
    case "oldest":
      return (
        a.createdAt.getTime() - b.createdAt.getTime() ||
        a.id.localeCompare(b.id)
      );
    case "position":
    default:
      return (
        a.position - b.position ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id)
      );
  }
}

function buildTree(
  categories: CategoryDto[],
  sort: CategoryQueryInput["sort"] = "position",
): CategoryDto[] {
  const selectedIds = new Set(categories.map((category) => category.id));
  const clones = new Map(
    categories.map((category) => [
      category.id,
      { ...category, children: [] as CategoryDto[] },
    ]),
  );
  const roots: CategoryDto[] = [];

  for (const category of categories) {
    const clone = clones.get(category.id)!;
    if (category.parentId && selectedIds.has(category.parentId)) {
      clones.get(category.parentId)!.children!.push(clone);
    } else {
      roots.push(clone);
    }
  }

  const sortLevel = (nodes: CategoryDto[]) => {
    nodes.sort((a, b) => compareCategories(a, b, sort));
    for (const node of nodes) sortLevel(node.children ?? []);
  };
  sortLevel(roots);
  return roots;
}

export async function listCategories(
  query: CategoryQueryInput,
  options?: {
    effectiveActiveOnly?: boolean;
    activeProductsOnly?: boolean;
  },
) {
  const graph = await loadCategoryGraph(options);
  const search = query.search?.toLocaleLowerCase();

  let items = [...graph.dtoById.values()].filter((category) => {
    if (options?.effectiveActiveOnly && !category.effectiveActive) return false;
    if (query.status && category.status !== query.status) return false;
    if (query.parentId !== undefined && category.parentId !== query.parentId) {
      return false;
    }
    if (!search) return true;
    const searchable = [
      category.name,
      category.slug,
      category.path,
      ...category.breadcrumb.map((item) => item.name),
    ]
      .join(" ")
      .toLocaleLowerCase();
    return searchable.includes(search);
  });

  items.sort((a, b) => compareCategories(a, b, query.sort));
  const total = items.length;

  if (query.view === "tree") {
    const tree = buildTree(items, query.sort);
    return {
      items: tree,
      meta: {
        page: 1,
        pageSize: total,
        total,
        totalPages: 1,
      },
    };
  }

  const skip = (query.page - 1) * query.pageSize;
  items = items.slice(skip, skip + query.pageSize);
  return {
    items,
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  };
}

const getCachedCategoryList = unstable_cache(
  async (
    query: CategoryQueryInput,
    effectiveActiveOnly: boolean,
    activeProductsOnly: boolean,
  ) => listCategories(query, { effectiveActiveOnly, activeProductsOnly }),
  ["categories-list-v2"],
  {
    revalidate: CATEGORY_CACHE_SECONDS,
    tags: [
      catalogCacheTags.catalog,
      catalogCacheTags.listings,
      catalogCacheTags.categoryTree,
    ],
  },
);

export function listCategoriesCached(
  query: CategoryQueryInput,
  options: {
    effectiveActiveOnly?: boolean;
    activeProductsOnly?: boolean;
  } = { effectiveActiveOnly: true, activeProductsOnly: true },
) {
  return getCachedCategoryList(
    query,
    options.effectiveActiveOnly ?? false,
    options.activeProductsOnly ?? false,
  );
}

export async function getCategoryById(
  id: string,
  options?: {
    effectiveActiveOnly?: boolean;
    activeProductsOnly?: boolean;
  },
): Promise<CategoryDto | null> {
  const graph = await loadCategoryGraph(options);
  const category = graph.dtoById.get(id) ?? null;
  if (options?.effectiveActiveOnly && !category?.effectiveActive) return null;
  return category;
}

export type PublicCategoryProduct = {
  id: string;
  productCode: string;
  slug: string;
  name: string;
  description: string | null;
  price: number;
  discountPrice: number | null;
  image: string | null;
  inStock: boolean;
  variantCount: number;
  rating: number;
  reviewCount: number;
};

export type PublicCategory = CategoryDto & {
  children: CategoryDto[];
  products: PublicCategoryProduct[];
};

async function loadActiveCategoryTree(): Promise<CategoryDto[]> {
  const graph = await loadCategoryGraph({
    activeProductsOnly: true,
    effectiveActiveOnly: true,
  });
  const active = [...graph.dtoById.values()].filter(
    (category) => category.effectiveActive,
  );
  return buildTree(active, "position");
}

const getCachedActiveCategoryTree = unstable_cache(
  loadActiveCategoryTree,
  ["active-category-tree-v2"],
  {
    revalidate: CATEGORY_CACHE_SECONDS,
    tags: [catalogCacheTags.categoryTree],
  },
);

export function getActiveCategoryTree(): Promise<CategoryDto[]> {
  return getCachedActiveCategoryTree();
}

async function loadActiveCategoryByPath(
  inputPath: string,
): Promise<PublicCategory | null> {
  const path = normalizeCategoryPath(inputPath);
  if (!path) return null;

  const graph = await loadCategoryGraph({
    activeProductsOnly: true,
    effectiveActiveOnly: true,
  });
  const record = graph.records.find((category) => category.path === path);
  if (!record || !graph.effectiveActiveIds.has(record.id)) return null;

  const category = graph.dtoById.get(record.id)!;
  const children = [...graph.dtoById.values()]
    .filter(
      (candidate) =>
        candidate.parentId === category.id && candidate.effectiveActive,
    )
    .sort((a, b) => compareCategories(a, b, "position"));
  const subtreeIds = graph.records
    .filter(
      (candidate) =>
        graph.effectiveActiveIds.has(candidate.id) &&
        isCategoryPathInSubtree(candidate.path, path),
    )
    .map((candidate) => candidate.id);

  const products = await prisma.product.findMany({
    where: { categoryId: { in: subtreeIds }, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    take: CATEGORY_LANDING_PRODUCT_LIMIT,
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      productCode: true,
      salePrice: true,
      discountPrice: true,
      images: {
        orderBy: { position: "asc" },
        take: 1,
        select: { url: true },
      },
    },
  });

  const productIds = products.map((product) => product.id);
  const [variantStats, reviewStats] =
    productIds.length > 0
      ? await Promise.all([
          prisma.productVariant.groupBy({
            by: ["productId"],
            where: { productId: { in: productIds }, isActive: true },
            _count: { _all: true },
            _sum: { stock: true },
          }),
          prisma.review.groupBy({
            by: ["productId"],
            where: { productId: { in: productIds } },
            _count: { _all: true },
            _avg: { rating: true },
          }),
        ])
      : [[], []];
  const variantsByProduct = new Map(
    variantStats.map((row) => [row.productId, row]),
  );
  const reviewsByProduct = new Map(
    reviewStats.map((row) => [row.productId, row]),
  );

  return {
    ...category,
    children,
    products: products.map((product) => {
      const price = product.salePrice.toNumber();
      const candidateDiscount = product.discountPrice?.toNumber() ?? null;
      const discountPrice =
        candidateDiscount !== null && candidateDiscount < price
          ? candidateDiscount
          : null;
      const variantSummary = variantsByProduct.get(product.id);
      const reviewSummary = reviewsByProduct.get(product.id);
      const stock = variantSummary?._sum.stock ?? 0;
      const variantCount = variantSummary?._count._all ?? 0;
      const reviewCount = reviewSummary?._count._all ?? 0;
      const rating = reviewSummary?._avg.rating ?? 0;
      return {
        id: product.id,
        productCode: product.productCode,
        slug: product.slug,
        name: product.name,
        description: product.description,
        price,
        discountPrice,
        image: product.images[0]?.url ?? null,
        inStock: stock > 0,
        variantCount,
        rating,
        reviewCount,
      };
    }),
  };
}

export function getActiveCategoryByPath(
  path: string,
): Promise<PublicCategory | null> {
  const normalizedPath = normalizeCategoryPath(path);
  if (!normalizedPath) return Promise.resolve(null);

  return unstable_cache(
    () => loadActiveCategoryByPath(normalizedPath),
    ["active-category-by-path-v4", normalizedPath],
    {
      revalidate: CATEGORY_CACHE_SECONDS,
      tags: [
        catalogCacheTags.categoryTree,
        catalogCacheTags.categoryPath(normalizedPath),
      ],
    },
  )();
}

/** Compatibility for the former root-only `/categories/[slug]` page. */
export function getActiveCategoryBySlug(
  slug: string,
): Promise<PublicCategory | null> {
  return getActiveCategoryByPath(slug);
}

type CategoryReader = Pick<Prisma.TransactionClient, "category">;

async function loadCategoryRecords(
  client: CategoryReader = prisma,
): Promise<CategoryRecord[]> {
  return client.category.findMany({ select: categoryRecordSelect });
}

export async function getEffectiveActiveCategoryIds(
  client: CategoryReader = prisma,
): Promise<string[]> {
  const records = await loadCategoryRecords(client);
  const byId = new Map(records.map((record) => [record.id, record]));
  return [...computeEffectiveActiveIds(records, byId)];
}

/** Grammar-compatible alias for existing service callers. */
export const getEffectivelyActiveCategoryIds = getEffectiveActiveCategoryIds;

export async function isCategoryEffectivelyActive(
  categoryId: string,
): Promise<boolean> {
  const activeIds = await getEffectiveActiveCategoryIds();
  return activeIds.includes(categoryId);
}

export type CategoryIdentifier =
  { id: string; path?: never } | { path: string; id?: never };

export async function getCategorySubtreeIds(
  identifier: CategoryIdentifier,
  options?: { effectiveActiveOnly?: boolean },
): Promise<string[]> {
  const records = await loadCategoryRecords();
  const target =
    "id" in identifier && identifier.id
      ? records.find((record) => record.id === identifier.id)
      : records.find(
          (record) =>
            record.path ===
            normalizeCategoryPath((identifier as { path: string }).path),
        );
  if (!target) return [];

  let activeIds: Set<string> | undefined;
  if (options?.effectiveActiveOnly) {
    const byId = new Map(records.map((record) => [record.id, record]));
    activeIds = computeEffectiveActiveIds(records, byId);
  }

  return records
    .filter(
      (record) =>
        (!activeIds || activeIds.has(record.id)) &&
        isCategoryPathInSubtree(record.path, target.path),
    )
    .map((record) => record.id);
}

/**
 * Batch breadcrumbs include the category itself as the final crumb. This is
 * convenient for product DTOs, while CategoryDto.breadcrumb contains only
 * ancestors to avoid repeating the category row itself.
 */
export async function getCategoryBreadcrumbsByIds(
  ids: readonly string[],
): Promise<Map<string, CategoryBreadcrumb[]>> {
  const records = await loadCategoryRecords();
  const byId = new Map(records.map((record) => [record.id, record]));
  const requested = new Set(ids);
  const result = new Map<string, CategoryBreadcrumb[]>();

  for (const record of records) {
    if (!requested.has(record.id)) continue;
    result.set(record.id, [
      ...buildBreadcrumb(record, byId),
      toBreadcrumb(record),
    ]);
  }

  return result;
}

export function categoryHasProducts(id: string): Promise<boolean> {
  return prisma.product
    .findFirst({ where: { categoryId: id }, select: { id: true } })
    .then((row) => row !== null);
}

type CategoryTransaction = Prisma.TransactionClient;

type CategoryPathMove = {
  entityId: string;
  oldPath: string;
  newPath: string;
};

async function recordCategoryPathMoves(
  tx: CategoryTransaction,
  moves: readonly CategoryPathMove[],
): Promise<void> {
  const redirects = moves
    .map((move) => ({
      entityId: move.entityId,
      sourcePath: categoryRoutePath(move.oldPath),
      destinationPath: categoryRoutePath(move.newPath),
    }))
    .filter((move) => move.sourcePath !== move.destinationPath);
  if (redirects.length === 0) return;

  // A destination may be a historical source when a category moves back to
  // an earlier location. It is live again, so it must no longer redirect.
  await tx.catalogRedirect.deleteMany({
    where: {
      sourcePath: { in: redirects.map((redirect) => redirect.destinationPath) },
      entityType: "CATEGORY",
    },
  });

  for (const redirect of redirects) {
    // Collapse earlier hops that pointed at the path being moved now.
    await tx.catalogRedirect.updateMany({
      where: {
        destinationPath: redirect.sourcePath,
        entityType: "CATEGORY",
      },
      data: { destinationPath: redirect.destinationPath },
    });

    await tx.catalogRedirect.upsert({
      where: { sourcePath: redirect.sourcePath },
      update: {
        destinationPath: redirect.destinationPath,
        entityType: "CATEGORY",
        entityId: redirect.entityId,
        permanent: true,
      },
      create: {
        sourcePath: redirect.sourcePath,
        destinationPath: redirect.destinationPath,
        entityType: "CATEGORY",
        entityId: redirect.entityId,
        permanent: true,
      },
    });
  }
}

async function withCategoryTreeLock<T>(
  operation: (tx: CategoryTransaction) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${CATEGORY_TREE_LOCK_KEY}))`;
    return operation(tx);
  });
}

async function getSiblingRows(
  tx: CategoryTransaction,
  parentId: string | null,
  excludeId?: string,
) {
  return tx.category.findMany({
    where: {
      parentId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    select: { id: true, slug: true, position: true },
  });
}

function assertPosition(position: number, maximum: number): void {
  if (position > maximum) {
    throw new CategoryServiceError(
      "INVALID_POSITION",
      `Position must be between 0 and ${maximum}.`,
      400,
      { maximumPosition: maximum },
    );
  }
}

async function writeSiblingPositions(
  tx: CategoryTransaction,
  orderedIds: readonly string[],
): Promise<void> {
  for (let position = 0; position < orderedIds.length; position += 1) {
    await tx.category.update({
      where: { id: orderedIds[position] },
      data: { position },
      select: { id: true },
    });
  }
}

async function normalizeSiblingPositions(
  tx: CategoryTransaction,
  parentId: string | null,
): Promise<void> {
  const siblings = await getSiblingRows(tx, parentId);
  await writeSiblingPositions(
    tx,
    siblings.map((sibling) => sibling.id),
  );
}

async function generateSiblingSlug(
  tx: CategoryTransaction,
  name: string,
  parentId: string | null,
  parentPath: string | null,
): Promise<string> {
  const base = slugify(name) || "category";
  const siblings = await getSiblingRows(tx, parentId);
  const usedSlugs = new Set(siblings.map((sibling) => sibling.slug));

  for (let suffix = 1; suffix <= 10_000; suffix += 1) {
    const candidate = suffix === 1 ? base : `${base}-${suffix}`;
    if (usedSlugs.has(candidate)) continue;
    const path = parentPath ? `${parentPath}/${candidate}` : candidate;
    const pathCollision = await tx.category.findUnique({
      where: { path },
      select: { id: true },
    });
    if (!pathCollision) return candidate;
  }

  throw new CategoryServiceError(
    "PATH_CONFLICT",
    "Could not generate a unique category path.",
    409,
  );
}

export async function createCategory(
  input: CreateCategoryInput,
): Promise<CategoryDto> {
  const createdId = await withCategoryTreeLock(async (tx) => {
    const parent = input.parentId
      ? await tx.category.findUnique({
          where: { id: input.parentId },
          select: { id: true, path: true, depth: true },
        })
      : null;
    if (input.parentId && !parent) {
      throw new CategoryServiceError(
        "PARENT_NOT_FOUND",
        "Parent category not found.",
        400,
        { parentId: input.parentId },
      );
    }

    const siblings = await getSiblingRows(tx, input.parentId);
    const desiredPosition = input.position ?? siblings.length;
    assertPosition(desiredPosition, siblings.length);

    const slug = await generateSiblingSlug(
      tx,
      input.name,
      input.parentId,
      parent?.path ?? null,
    );
    const path = parent ? `${parent.path}/${slug}` : slug;
    const created = await tx.category.create({
      data: {
        name: input.name,
        slug,
        path,
        depth: parent ? parent.depth + 1 : 0,
        parentId: input.parentId,
        position: desiredPosition,
        description: input.description ?? null,
        image: input.image ?? null,
        seoTitle: cleanOptionalText(input.seoTitle) ?? null,
        metaDescription: cleanOptionalText(input.metaDescription) ?? null,
        ogImage: cleanOptionalText(input.ogImage) ?? null,
        status: input.status,
      },
      select: { id: true },
    });
    await releaseCatalogRedirectSources(tx, [`/categories/${path}`]);

    const orderedIds = siblings.map((sibling) => sibling.id);
    orderedIds.splice(desiredPosition, 0, created.id);
    await writeSiblingPositions(tx, orderedIds);
    return created.id;
  });

  const category = await getCategoryById(createdId);
  if (!category) {
    throw new CategoryServiceError(
      "CATEGORY_NOT_FOUND",
      "Category was created but could not be reloaded.",
      404,
    );
  }
  return category;
}

export async function updateCategory(
  id: string,
  input: UpdateCategoryInput,
): Promise<CategoryDto> {
  await withCategoryTreeLock(async (tx) => {
    const existing = await tx.category.findUnique({
      where: { id },
      select: categoryRecordSelect,
    });
    if (!existing) {
      throw new CategoryServiceError(
        "CATEGORY_NOT_FOUND",
        "Category not found.",
        404,
      );
    }

    const hasParentUpdate = Object.prototype.hasOwnProperty.call(
      input,
      "parentId",
    );
    const nextParentId = hasParentUpdate
      ? (input.parentId ?? null)
      : existing.parentId;
    const isMove = nextParentId !== existing.parentId;

    if (nextParentId === id) {
      throw new CategoryServiceError(
        "SELF_PARENT",
        "A category cannot be its own parent.",
        400,
      );
    }

    const nextParent = nextParentId
      ? await tx.category.findUnique({
          where: { id: nextParentId },
          select: { id: true, path: true, depth: true },
        })
      : null;
    if (nextParentId && !nextParent) {
      throw new CategoryServiceError(
        "PARENT_NOT_FOUND",
        "Parent category not found.",
        400,
        { parentId: nextParentId },
      );
    }

    if (nextParent && isCategoryPathInSubtree(nextParent.path, existing.path)) {
      throw new CategoryServiceError(
        "CATEGORY_CYCLE",
        "A category cannot be moved below one of its descendants.",
        400,
      );
    }

    const data: Prisma.CategoryUncheckedUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.image !== undefined) data.image = input.image;
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
    if (hasParentUpdate) data.parentId = nextParentId;

    let descendants: Array<{ id: string; path: string; depth: number }> = [];
    let pathMoves: CategoryPathMove[] = [];
    let newRootPath = existing.path;
    let newRootDepth = existing.depth;

    if (isMove) {
      newRootPath = nextParent
        ? `${nextParent.path}/${existing.slug}`
        : existing.slug;
      newRootDepth = nextParent ? nextParent.depth + 1 : 0;
      descendants = await tx.category.findMany({
        where: { path: { startsWith: `${existing.path}/` } },
        orderBy: { depth: "asc" },
        select: { id: true, path: true, depth: true },
      });

      const subtreeIds = [id, ...descendants.map((item) => item.id)];
      const candidatePaths = [
        newRootPath,
        ...descendants.map(
          (item) => newRootPath + item.path.slice(existing.path.length),
        ),
      ];
      const collision = await tx.category.findFirst({
        where: {
          id: { notIn: subtreeIds },
          path: { in: candidatePaths },
        },
        select: { id: true, path: true },
      });
      if (collision) {
        throw new CategoryServiceError(
          "PATH_CONFLICT",
          "The destination already contains a category with this path.",
          409,
          { path: collision.path },
        );
      }

      pathMoves = [
        { entityId: id, oldPath: existing.path, newPath: newRootPath },
        ...descendants.map((descendant) => ({
          entityId: descendant.id,
          oldPath: descendant.path,
          newPath: newRootPath + descendant.path.slice(existing.path.length),
        })),
      ];

      data.path = newRootPath;
      data.depth = newRootDepth;
    }

    if (Object.keys(data).length > 0) {
      await tx.category.update({
        where: { id },
        data,
        select: { id: true },
      });
    }

    if (isMove) {
      const depthDelta = newRootDepth - existing.depth;
      for (const descendant of descendants) {
        await tx.category.update({
          where: { id: descendant.id },
          data: {
            path: newRootPath + descendant.path.slice(existing.path.length),
            depth: descendant.depth + depthDelta,
          },
          select: { id: true },
        });
      }
      await recordCategoryPathMoves(tx, pathMoves);
      await normalizeSiblingPositions(tx, existing.parentId);
    }

    if (isMove || input.position !== undefined) {
      const siblings = await getSiblingRows(tx, nextParentId, id);
      const desiredPosition = input.position ?? siblings.length;
      assertPosition(desiredPosition, siblings.length);
      const orderedIds = siblings.map((sibling) => sibling.id);
      orderedIds.splice(desiredPosition, 0, id);
      await writeSiblingPositions(tx, orderedIds);
    }
  });

  const category = await getCategoryById(id);
  if (!category) {
    throw new CategoryServiceError(
      "CATEGORY_NOT_FOUND",
      "Category not found.",
      404,
    );
  }
  return category;
}

export async function reorderCategories(
  input: ReorderCategoriesInput,
): Promise<CategoryDto[]> {
  await withCategoryTreeLock(async (tx) => {
    if (input.parentId) {
      const parent = await tx.category.findUnique({
        where: { id: input.parentId },
        select: { id: true },
      });
      if (!parent) {
        throw new CategoryServiceError(
          "PARENT_NOT_FOUND",
          "Parent category not found.",
          400,
          { parentId: input.parentId },
        );
      }
    }

    const siblings = await getSiblingRows(tx, input.parentId);
    const actualIds = siblings.map((sibling) => sibling.id);
    const requested = new Set(input.orderedIds);
    const missingIds = actualIds.filter((id) => !requested.has(id));
    const unexpectedIds = input.orderedIds.filter(
      (id) => !actualIds.includes(id),
    );

    if (
      input.orderedIds.length !== actualIds.length ||
      missingIds.length > 0 ||
      unexpectedIds.length > 0
    ) {
      throw new CategoryServiceError(
        "INVALID_REORDER",
        "orderedIds must contain every sibling exactly once.",
        400,
        { missingIds, unexpectedIds },
      );
    }

    await writeSiblingPositions(tx, input.orderedIds);
  });

  const graph = await loadCategoryGraph();
  return input.orderedIds
    .map((id) => graph.dtoById.get(id))
    .filter((category): category is CategoryDto => Boolean(category));
}

export async function deleteCategory(id: string): Promise<CategoryDto> {
  return withCategoryTreeLock(async (tx) => {
    const existing = await tx.category.findUnique({
      where: { id },
      select: {
        ...categoryRecordSelect,
        _count: { select: { children: true } },
      },
    });
    if (!existing) {
      throw new CategoryServiceError(
        "CATEGORY_NOT_FOUND",
        "Category not found.",
        404,
      );
    }

    const subtree = await tx.category.findMany({
      where: {
        OR: [{ id }, { path: { startsWith: `${existing.path}/` } }],
      },
      select: { id: true },
    });
    const subtreeIds = subtree.map((item) => item.id);
    const [directProductCount, totalProductCount] = await Promise.all([
      tx.product.count({ where: { categoryId: id } }),
      tx.product.count({ where: { categoryId: { in: subtreeIds } } }),
    ]);

    if (existing._count.children > 0 || directProductCount > 0) {
      throw new CategoryServiceError(
        "DELETE_CONFLICT",
        "Only an empty leaf category can be deleted.",
        409,
        {
          childCount: existing._count.children,
          directProductCount,
          totalProductCount,
        },
      );
    }

    const allRecords = await tx.category.findMany({
      select: categoryRecordSelect,
    });
    const snapshot = buildCategoryGraph(
      allRecords,
      new Map([[id, directProductCount]]),
      false,
    ).dtoById.get(id)!;

    await tx.category.delete({ where: { id }, select: { id: true } });
    await deleteCatalogRedirectsForEntity(tx, "CATEGORY", id);
    await normalizeSiblingPositions(tx, existing.parentId);
    return snapshot;
  });
}

export function softDeleteCategory(id: string): Promise<CategoryDto> {
  return updateCategory(id, { status: "INACTIVE" });
}

/**
 * Deprecated compatibility wrapper. It no longer deletes products: the
 * category deletion policy permits only empty leaf categories.
 */
export async function hardDeleteCategoryWithProducts(id: string) {
  const category = await deleteCategory(id);
  return { category, deletedProducts: 0 };
}
