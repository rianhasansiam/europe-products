import { readApiError } from "@/features/http/api-envelope";
import { addActiveApiLocale } from "@/lib/i18n/api-locale";

export type PublicCategoryNode = {
  id: string;
  name: string;
  slug: string;
  path: string;
  description: string | null;
  image: string | null;
  depth: number;
  position: number;
  childCount: number;
  directProductCount: number;
  totalProductCount: number;
  children: PublicCategoryNode[];
};

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function string(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function number(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parsePublicCategoryNode(value: unknown): PublicCategoryNode {
  const row = record(value) ?? {};
  const directProductCount = number(row.directProductCount ?? row.productCount);
  return {
    id: string(row.id),
    name: string(row.name),
    slug: string(row.slug),
    path: string(row.path) || string(row.slug),
    description: typeof row.description === "string" ? row.description : null,
    image: typeof row.image === "string" ? row.image : null,
    depth: number(row.depth),
    position: number(row.position),
    childCount: number(row.childCount),
    directProductCount,
    totalProductCount: number(row.totalProductCount ?? directProductCount),
    children: Array.isArray(row.children)
      ? row.children.map(parsePublicCategoryNode)
      : [],
  };
}

export function parsePublicCategoryTree(payload: unknown): PublicCategoryNode[] {
  const envelope = record(payload);
  if (!envelope?.success || !Array.isArray(envelope.data)) {
    throw new Error("Categories API returned an invalid tree.");
  }
  return envelope.data.map(parsePublicCategoryNode);
}

export async function fetchPublicCategoryTree(
  signal?: AbortSignal,
): Promise<PublicCategoryNode[]> {
  const params = new URLSearchParams({
    view: "tree",
    status: "ACTIVE",
    withCounts: "true",
  });
  const response = await fetch(`/api/categories?${addActiveApiLocale(params).toString()}`, { signal });
  let payload: unknown;
  try {
    payload = (await response.json()) as unknown;
  } catch {
    throw new Error("Failed to parse category navigation.");
  }
  if (!response.ok) {
    throw new Error(readApiError(payload, "Failed to load category navigation."));
  }
  return parsePublicCategoryTree(payload);
}

export function categoryHref(category: Pick<PublicCategoryNode, "path">): string {
  return `/categories/${category.path}`;
}

export function flattenCategoryTree(
  tree: PublicCategoryNode[],
): PublicCategoryNode[] {
  const output: PublicCategoryNode[] = [];
  const walk = (nodes: PublicCategoryNode[]) => {
    for (const node of nodes) {
      output.push(node);
      walk(node.children);
    }
  };
  walk(tree);
  return output;
}
