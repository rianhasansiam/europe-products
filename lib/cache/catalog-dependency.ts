import "server-only";

import { createHash } from "crypto";
import { unstable_cache } from "next/cache";

/**
 * Attach entity tags to a Full Route Cache entry without caching Prisma
 * records. This keeps rich server rendering type-safe while allowing a
 * related entity mutation to expire every route that embedded its data.
 */
export async function dependOnCatalogTags(tags: Iterable<string>): Promise<void> {
  const normalized = [...new Set(tags)]
    .map((tag) => tag.trim())
    .filter(Boolean)
    .sort();
  if (normalized.length === 0) return;

  const key = createHash("sha256").update(normalized.join("\n")).digest("hex");
  await unstable_cache(async () => true, ["catalog-dependency-v1", key], {
    revalidate: false,
    tags: normalized,
  })();
}
