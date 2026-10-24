import "server-only";

import type {
  CatalogRedirectEntityType,
  Prisma,
} from "@/app/generated/prisma/client";
import { unstable_cache } from "next/cache";

import { catalogCacheTags } from "@/lib/cache/catalog-tags";
import { prisma } from "@/lib/db/prisma";

const CATALOG_REDIRECT_CACHE_SECONDS = 1800;

export type CatalogRedirectDto<
  EntityType extends CatalogRedirectEntityType = CatalogRedirectEntityType,
> = {
  sourcePath: string;
  destinationPath: string;
  entityType: EntityType;
  entityId: string;
  permanent: boolean;
};

export type CatalogRedirectMove = {
  entityId: string;
  sourcePath: string;
  destinationPath: string;
};

/** Remove stale history when a path becomes live again in the same write. */
export async function releaseCatalogRedirectSources(
  tx: Prisma.TransactionClient,
  sourcePaths: readonly string[],
): Promise<void> {
  const normalizedPaths = [
    ...new Set(
      sourcePaths.flatMap((sourcePath) => {
        const normalized = normalizeRoutePath(sourcePath);
        return normalized ? [normalized] : [];
      }),
    ),
  ];
  if (normalizedPaths.length === 0) return;

  await tx.catalogRedirect.deleteMany({
    where: { sourcePath: { in: normalizedPaths } },
  });
}

/** Remove all history owned by an entity before its hard deletion commits. */
export async function deleteCatalogRedirectsForEntity(
  tx: Prisma.TransactionClient,
  entityType: CatalogRedirectEntityType,
  entityId: string,
): Promise<void> {
  await tx.catalogRedirect.deleteMany({ where: { entityType, entityId } });
}

function normalizeRoutePath(path: string): string | null {
  const normalized = path
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "");
  return normalized ? `/${normalized}` : null;
}

export function catalogRoutePath(
  routePrefix: string,
  relativePath: string,
): string | null {
  const prefix = routePrefix
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "");
  const normalized = relativePath
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "");
  if (!prefix || !normalized || normalized === prefix) return null;
  const withoutPrefix = normalized.startsWith(`${prefix}/`)
    ? normalized.slice(prefix.length + 1)
    : normalized;
  return withoutPrefix ? `/${prefix}/${withoutPrefix}` : null;
}

/** Record redirect history in the caller's mutation transaction. */
export async function recordCatalogRedirectMoves(
  tx: Prisma.TransactionClient,
  entityType: CatalogRedirectEntityType,
  moves: readonly CatalogRedirectMove[],
): Promise<void> {
  const redirects = moves.flatMap((move) => {
    const sourcePath = normalizeRoutePath(move.sourcePath);
    const destinationPath = normalizeRoutePath(move.destinationPath);
    return sourcePath && destinationPath && sourcePath !== destinationPath
      ? [{ ...move, sourcePath, destinationPath }]
      : [];
  });
  if (redirects.length === 0) return;

  // A former source can become a live destination again when a slug is
  // reused or changed back. Live URLs always win over redirect history.
  await releaseCatalogRedirectSources(
    tx,
    redirects.map((redirect) => redirect.destinationPath),
  );

  for (const redirect of redirects) {
    // Keep old inbound URLs on one hop by rewriting earlier destinations.
    await tx.catalogRedirect.updateMany({
      where: {
        destinationPath: redirect.sourcePath,
        entityType,
      },
      data: { destinationPath: redirect.destinationPath },
    });

    await tx.catalogRedirect.upsert({
      where: { sourcePath: redirect.sourcePath },
      update: {
        destinationPath: redirect.destinationPath,
        entityType,
        entityId: redirect.entityId,
        permanent: true,
      },
      create: {
        sourcePath: redirect.sourcePath,
        destinationPath: redirect.destinationPath,
        entityType,
        entityId: redirect.entityId,
        permanent: true,
      },
    });
  }
}

const redirectSelect = {
  sourcePath: true,
  destinationPath: true,
  entityType: true,
  entityId: true,
  permanent: true,
} satisfies Prisma.CatalogRedirectSelect;

type CatalogRedirectIndex = Record<string, CatalogRedirectDto>;

const getCachedCatalogRedirectIndex = unstable_cache(
  async (): Promise<CatalogRedirectIndex> => {
    const redirects = await prisma.catalogRedirect.findMany({
      select: redirectSelect,
    });

    return Object.fromEntries(
      redirects.map((redirect) => [redirect.sourcePath, redirect]),
    );
  },
  ["catalog-redirect-index-v1"],
  {
    revalidate: CATALOG_REDIRECT_CACHE_SECONDS,
    tags: [catalogCacheTags.redirects],
  },
);

export async function getCatalogRedirectByPath<
  EntityType extends CatalogRedirectEntityType,
>(
  sourcePath: string,
  entityType: EntityType,
): Promise<CatalogRedirectDto<EntityType> | null> {
  const normalized = normalizeRoutePath(sourcePath);
  if (!normalized) return null;
  const redirect = (await getCachedCatalogRedirectIndex())[normalized];
  return redirect?.entityType === entityType
    ? { ...redirect, entityType }
    : null;
}
