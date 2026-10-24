export type CategoryPerformanceInput = {
  id: string;
  name: string;
  path: string;
  parentId: string | null;
  depth: number;
  status: "ACTIVE" | "INACTIVE";
  directProductCount: number;
};

export type CategorySalesInput = {
  categoryId: string;
  unitsSold: number;
  revenue: number;
};

export type DirectCategoryPerformanceRow = {
  categoryId: string;
  name: string;
  breadcrumbLabel: string;
  path: string;
  depth: number;
  status: "ACTIVE" | "INACTIVE";
  directProductCount: number;
  /** Compatibility alias for the original report client. */
  productCount: number;
  unitsSold: number;
  revenue: number;
};

export type RootCategoryRollup = {
  categoryId: string;
  name: string;
  path: string;
  status: "ACTIVE" | "INACTIVE";
  categoryCount: number;
  totalProductCount: number;
  unitsSold: number;
  revenue: number;
};

export type CategoryPerformance = {
  rows: DirectCategoryPerformanceRow[];
  rootRollups: RootCategoryRollup[];
  totals: {
    products: number;
    unitsSold: number;
    revenue: number;
  };
};

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Build direct category rows and a second, non-overlapping root summary.
 * Every category contributes to exactly one root rollup, so adding root rows
 * never counts a descendant again through each of its intermediate parents.
 */
export function buildCategoryPerformance(
  categories: readonly CategoryPerformanceInput[],
  sales: readonly CategorySalesInput[],
): CategoryPerformance {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const salesByCategory = new Map(
    sales.map((row) => [
      row.categoryId,
      { unitsSold: row.unitsSold, revenue: roundCurrency(row.revenue) },
    ]),
  );
  const rootIdCache = new Map<string, string>();
  const breadcrumbCache = new Map<string, string>();

  const rootIdFor = (categoryId: string): string => {
    const cached = rootIdCache.get(categoryId);
    if (cached) return cached;

    const seen = new Set<string>();
    const trail: string[] = [];
    let current = byId.get(categoryId);
    while (current?.parentId && !seen.has(current.id)) {
      seen.add(current.id);
      trail.push(current.id);
      const parent = byId.get(current.parentId);
      if (!parent) break;
      current = parent;
    }

    const rootId = current?.id ?? categoryId;
    rootIdCache.set(categoryId, rootId);
    for (const id of trail) rootIdCache.set(id, rootId);
    return rootId;
  };

  const breadcrumbFor = (categoryId: string): string => {
    const cached = breadcrumbCache.get(categoryId);
    if (cached) return cached;

    const names: string[] = [];
    const seen = new Set<string>();
    let current = byId.get(categoryId);
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      names.unshift(current.name);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }

    const label = names.join(" / ") || byId.get(categoryId)?.name || "Category";
    breadcrumbCache.set(categoryId, label);
    return label;
  };

  const rows: DirectCategoryPerformanceRow[] = categories.map((category) => {
    const directSales = salesByCategory.get(category.id);
    return {
      categoryId: category.id,
      name: category.name,
      breadcrumbLabel: breadcrumbFor(category.id),
      path: category.path,
      depth: category.depth,
      status: category.status,
      directProductCount: category.directProductCount,
      productCount: category.directProductCount,
      unitsSold: directSales?.unitsSold ?? 0,
      revenue: directSales?.revenue ?? 0,
    };
  });

  const rollupByRoot = new Map<string, RootCategoryRollup>();
  for (const row of rows) {
    const rootId = rootIdFor(row.categoryId);
    const root = byId.get(rootId) ?? byId.get(row.categoryId);
    if (!root) continue;

    const aggregate = rollupByRoot.get(rootId) ?? {
      categoryId: rootId,
      name: root.name,
      path: root.path,
      status: root.status,
      categoryCount: 0,
      totalProductCount: 0,
      unitsSold: 0,
      revenue: 0,
    };
    aggregate.categoryCount += 1;
    aggregate.totalProductCount += row.directProductCount;
    aggregate.unitsSold += row.unitsSold;
    aggregate.revenue = roundCurrency(aggregate.revenue + row.revenue);
    rollupByRoot.set(rootId, aggregate);
  }

  return {
    rows: rows.sort(
      (a, b) => b.revenue - a.revenue || a.path.localeCompare(b.path),
    ),
    rootRollups: [...rollupByRoot.values()].sort(
      (a, b) => b.revenue - a.revenue || a.path.localeCompare(b.path),
    ),
    totals: rows.reduce(
      (totals, row) => ({
        products: totals.products + row.directProductCount,
        unitsSold: totals.unitsSold + row.unitsSold,
        revenue: roundCurrency(totals.revenue + row.revenue),
      }),
      { products: 0, unitsSold: 0, revenue: 0 },
    ),
  };
}
