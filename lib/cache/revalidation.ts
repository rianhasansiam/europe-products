import "server-only";

import { revalidateTag } from "next/cache";

export const CACHE_PROFILE = "max" as const;

function logFailure(tag: string, mode: "stale" | "expire", error: unknown) {
  console.error("[cache] Tag revalidation failed", { tag, mode, error });
}

export function revalidateCacheTags(tags: readonly string[] | undefined) {
  if (!tags?.length) return;
  for (const tag of tags) {
    try {
      revalidateTag(tag, CACHE_PROFILE);
    } catch (error) {
      logFailure(tag, "stale", error);
    }
  }
}

/** Catalog writes require blocking expiry so the next storefront read is fresh. */
export function revalidateCacheTagsImmediately(
  tags: readonly string[] | undefined,
) {
  if (!tags?.length) return;
  for (const tag of tags) {
    try {
      revalidateTag(tag, { expire: 0 });
    } catch (error) {
      logFailure(tag, "expire", error);
    }
  }
}
