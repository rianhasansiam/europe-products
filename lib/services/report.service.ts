import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";

import { BASE_CURRENCY } from "@/lib/currency/config";
import { assertUsdPricingReady } from "@/lib/currency/pricing-readiness";
import { getStoreSettings } from "@/lib/services/settings.service";
import { prisma } from "@/lib/db/prisma";
import { round2, toNumber } from "@/lib/money";
import { buildCategoryPerformance } from "@/lib/reports/category-rollups";
import { getCategoryBreadcrumbsByIds } from "@/lib/services/category.service";
import { ServiceError } from "@/lib/services/service-error";
import type { ReportQueryInput } from "@/lib/validations/report.validation";

/**
 * Server-side report aggregations for the admin "Reports" page.
 *
 * Each report type returns a payload ready for the client to render
 * (preview table + PDF). Money fields are rounded to 2 dp at the
 * service edge so the PDF and the on-screen preview never disagree.
 */

export class ReportError extends ServiceError {
  constructor(
    status: number,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(status, message, details);
    this.name = "ReportError";
  }
}

/* -------------------------------------------------------------------------- */
/*  Shared helpers                                                            */
/* -------------------------------------------------------------------------- */

/** Round currency to 2 dp; accepts Decimal or number. Use everywhere here. */
function money(value: Parameters<typeof toNumber>[0]): number {
  return round2(value);
}

async function categoryLabelsById(
  categoryIds: readonly string[],
): Promise<Map<string, string>> {
  const ids = [...new Set(categoryIds.filter(Boolean))];
  if (ids.length === 0) return new Map();

  const breadcrumbs = await getCategoryBreadcrumbsByIds(ids);
  return new Map(
    ids.map((id) => [
      id,
      (breadcrumbs.get(id) ?? []).map((crumb) => crumb.name).join(" / "),
    ]),
  );
}

/**
 * Resolve the [from, to] window the report should cover.
 *
 *   - When `from` is missing, default to 30 days before `to`.
 *   - When `to` is missing, default to now.
 *   - The window is inclusive on both ends; we widen `to` to the
 *     end-of-day so callers can pass a date-only string and still
 *     capture the orders placed that same evening.
 */
function resolveWindow(query: ReportQueryInput) {
  const now = new Date();

  // All-time mode: span from the epoch to now so every order is in range.
  if (query.allTime) {
    return { from: new Date(0), to: now };
  }

  let to = query.to ? new Date(query.to) : now;
  // Widen to end-of-day when the caller passed a calendar date only.
  if (query.to && /^\d{4}-\d{2}-\d{2}$/.test(query.to)) {
    to = new Date(`${query.to}T23:59:59.999Z`);
  }

  let from = query.from ? new Date(query.from) : null;
  if (!from) {
    from = new Date(to);
    from.setDate(from.getDate() - 30);
  }
  // For pure dates, anchor at start-of-day so the window is intuitive.
  if (query.from && /^\d{4}-\d{2}-\d{2}$/.test(query.from)) {
    from = new Date(`${query.from}T00:00:00.000Z`);
  }

  return { from, to };
}

type Window = { from: Date; to: Date };

/** Common Prisma `where` block filtering Order rows by createdAt. */
function orderDateWhere(window: Window): Prisma.OrderWhereInput {
  return { currency: BASE_CURRENCY, createdAt: { gte: window.from, lte: window.to } };
}

/* -------------------------------------------------------------------------- */
/*  1. Sales report                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Sales overview: revenue, AOV, refund/cancel impact, payment-status
 * split, plus a daily series for the chart in the preview.
 *
 * Cancelled orders are excluded from the revenue figures but are
 * tracked separately so admins can see how much was at-risk vs. lost.
 */
async function buildSalesReport(window: Window, limit: number) {
  const where: Prisma.OrderWhereInput = orderDateWhere(window);

  const [orders, statusGroups, paymentGroups] = await Promise.all([
    prisma.order.findMany({
      where,
      select: {
        id: true,
        orderNumber: true,
        totalAmount: true,
        subtotal: true,
        deliveryCharge: true,
        discountAmount: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        customerName: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.order.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
    prisma.order.groupBy({
      by: ["paymentStatus"],
      where: { ...where, status: { not: "CANCELLED" } },
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
  ]);

  const totals = await prisma.order.aggregate({
    where,
    _count: { _all: true },
  });

  const liveAggregate = await prisma.order.aggregate({
    where: { ...where, status: { not: "CANCELLED" } },
    _sum: {
      totalAmount: true,
      subtotal: true,
      deliveryCharge: true,
      discountAmount: true,
    },
    _count: { _all: true },
  });

  const cancelledAggregate = await prisma.order.aggregate({
    where: { ...where, status: "CANCELLED" },
    _sum: { totalAmount: true },
    _count: { _all: true },
  });

  // Daily series — bucket by UTC date for a tidy chart.
  const dailyMap = new Map<
    string,
    { day: string; revenue: number; orders: number }
  >();
  const dayCursor = new Date(window.from);
  dayCursor.setUTCHours(0, 0, 0, 0);
  while (dayCursor <= window.to) {
    const key = dayCursor.toISOString().slice(0, 10);
    dailyMap.set(key, { day: key, revenue: 0, orders: 0 });
    dayCursor.setUTCDate(dayCursor.getUTCDate() + 1);
  }

  for (const order of orders) {
    if (order.status === "CANCELLED") continue;
    const key = new Date(order.createdAt).toISOString().slice(0, 10);
    const bucket = dailyMap.get(key);
    if (!bucket) continue;
    bucket.revenue = money(bucket.revenue + toNumber(order.totalAmount));
    bucket.orders += 1;
  }

  const totalRevenue = money(liveAggregate._sum.totalAmount ?? 0);
  const totalOrders = liveAggregate._count._all;
  const avgOrderValue = totalOrders > 0 ? money(totalRevenue / totalOrders) : 0;

  return {
    summary: {
      totalRevenue,
      totalOrders,
      avgOrderValue,
      grossSubtotal: money(liveAggregate._sum.subtotal ?? 0),
      totalDeliveryCharges: money(liveAggregate._sum.deliveryCharge ?? 0),
      totalDiscounts: money(liveAggregate._sum.discountAmount ?? 0),
      cancelledRevenue: money(cancelledAggregate._sum.totalAmount ?? 0),
      cancelledOrders: cancelledAggregate._count._all,
      ordersInWindow: totals._count._all,
    },
    byStatus: statusGroups.map((group) => ({
      status: group.status,
      orders: group._count._all,
      revenue: money(group._sum.totalAmount ?? 0),
    })),
    byPaymentStatus: paymentGroups.map((group) => ({
      paymentStatus: group.paymentStatus,
      orders: group._count._all,
      revenue: money(group._sum.totalAmount ?? 0),
    })),
    dailySeries: Array.from(dailyMap.values()),
    recentOrders: orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      totalAmount: money(order.totalAmount),
      createdAt: order.createdAt.toISOString(),
    })),
  };
}

/* -------------------------------------------------------------------------- */
/*  2. Orders report                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Order log: every order in the window with the line-item count and
 * the basic financial breakdown. Useful for end-of-day reconciliation.
 */
async function buildOrdersReport(window: Window, limit: number) {
  const where = orderDateWhere(window);

  const [rows, statusGroups, totals] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        customerPhone: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        subtotal: true,
        deliveryCharge: true,
        discountAmount: true,
        totalAmount: true,
        createdAt: true,
        _count: { select: { items: true } },
      },
    }),
    prisma.order.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
    }),
    prisma.order.aggregate({
      where,
      _count: { _all: true },
      _sum: { totalAmount: true, discountAmount: true },
    }),
  ]);

  return {
    summary: {
      totalOrders: totals._count._all,
      totalAmount: money(totals._sum.totalAmount ?? 0),
      totalDiscounts: money(totals._sum.discountAmount ?? 0),
    },
    byStatus: statusGroups.map((group) => ({
      status: group.status,
      orders: group._count._all,
    })),
    rows: rows.map((row) => ({
      id: row.id,
      orderNumber: row.orderNumber,
      customerName: row.customerName,
      customerPhone: row.customerPhone,
      status: row.status,
      paymentStatus: row.paymentStatus,
      paymentMethod: row.paymentMethod,
      itemsCount: row._count.items,
      subtotal: money(row.subtotal),
      deliveryCharge: money(row.deliveryCharge),
      discountAmount: money(row.discountAmount),
      totalAmount: money(row.totalAmount),
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

/* -------------------------------------------------------------------------- */
/*  3. Top products report                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Sales-by-product: aggregates OrderItem rows for non-cancelled orders
 * inside the window and ranks products by units sold and revenue.
 */
async function buildProductsReport(window: Window, limit: number) {
  const orderItems = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: {
      productId: { not: null },
      order: {
        currency: BASE_CURRENCY,
        createdAt: { gte: window.from, lte: window.to },
        status: { not: "CANCELLED" },
      },
    },
    _sum: { quantity: true },
    _count: { _all: true },
  });

  if (orderItems.length === 0) {
    return {
      summary: { uniqueProducts: 0, unitsSold: 0, revenue: 0 },
      rows: [],
    };
  }

  // Compute revenue per product from each line's price snapshot
  // (totalPrice), so revenue is correct even if the live product or
  // its variant price changed later.
  const productIds = orderItems
    .map((row) => row.productId)
    .filter((id): id is string => id !== null);

  const detailedRows = await prisma.orderItem.findMany({
    where: {
      productId: { in: productIds },
      order: {
        currency: BASE_CURRENCY,
        createdAt: { gte: window.from, lte: window.to },
        status: { not: "CANCELLED" },
      },
    },
    select: {
      productId: true,
      quantity: true,
      totalPrice: true,
    },
  });

  const productMap = new Map<string, { units: number; revenue: number }>();
  for (const row of detailedRows) {
    if (row.productId == null) continue;
    const bucket = productMap.get(row.productId) ?? { units: 0, revenue: 0 };
    bucket.units += row.quantity;
    bucket.revenue = round2(bucket.revenue + toNumber(row.totalPrice));
    productMap.set(row.productId, bucket);
  }

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      name: true,
      status: true,
      salePrice: true,
      discountPrice: true,
      category: { select: { id: true, name: true, path: true } },
      variants: {
        select: { stock: true },
      },
    },
  });
  const productInfo = new Map(products.map((p) => [p.id, p]));
  const categoryLabels = await categoryLabelsById(
    products.map((product) => product.category.id),
  );

  const rows = Array.from(productMap.entries())
    .map(([productId, agg]) => {
      const info = productInfo.get(productId);
      const currentPrice = info
        ? info.discountPrice != null &&
          info.discountPrice.lessThan(info.salePrice)
          ? info.discountPrice
          : info.salePrice
        : null;
      const currentStock = info
        ? info.variants.reduce((sum, v) => sum + v.stock, 0)
        : null;
      return {
        productId,
        name: info?.name ?? "Deleted product",
        category:
          (info && categoryLabels.get(info.category.id)) ||
          info?.category?.name ||
          "—",
        categoryPath: info?.category?.path ?? null,
        unitsSold: agg.units,
        revenue: money(agg.revenue),
        currentPrice: currentPrice != null ? money(currentPrice) : null,
        currentStock,
        status: info?.status ?? null,
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);

  const totalUnits = rows.reduce((sum, row) => sum + row.unitsSold, 0);
  const totalRevenue = money(rows.reduce((sum, row) => sum + row.revenue, 0));

  return {
    summary: {
      uniqueProducts: rows.length,
      unitsSold: totalUnits,
      revenue: totalRevenue,
    },
    rows,
  };
}

/* -------------------------------------------------------------------------- */
/*  4. Profit report                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Profit-by-product: for non-cancelled orders in the window, folds each
 * line's revenue (totalPrice snapshot) against its cost
 * (buyingPrice * quantity snapshot) to derive gross profit and margin.
 *
 * buyingPrice is nullable on legacy/imported line items; those rows
 * contribute 0 cost (and therefore show 100% margin), which is the
 * honest "we don't know the cost" reading rather than a guess.
 */
async function buildProfitReport(window: Window, limit: number) {
  const items = await prisma.orderItem.findMany({
    where: {
      productId: { not: null },
      order: {
        currency: BASE_CURRENCY,
        createdAt: { gte: window.from, lte: window.to },
        status: { not: "CANCELLED" },
      },
    },
    select: {
      productId: true,
      quantity: true,
      totalPrice: true,
      buyingPrice: true,
    },
  });

  if (items.length === 0) {
    return {
      summary: {
        totalRevenue: 0,
        totalCost: 0,
        grossProfit: 0,
        profitMargin: 0,
        unitsSold: 0,
        productsTracked: 0,
      },
      rows: [],
    };
  }

  const productMap = new Map<
    string,
    { units: number; revenue: number; cost: number }
  >();
  for (const item of items) {
    if (item.productId == null) continue;
    const bucket =
      productMap.get(item.productId) ?? { units: 0, revenue: 0, cost: 0 };
    bucket.units += item.quantity;
    bucket.revenue = round2(bucket.revenue + toNumber(item.totalPrice));
    bucket.cost = round2(
      bucket.cost + toNumber(item.buyingPrice) * item.quantity,
    );
    productMap.set(item.productId, bucket);
  }

  const productIds = Array.from(productMap.keys());
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      name: true,
      status: true,
      category: { select: { id: true, name: true, path: true } },
      variants: { select: { stock: true } },
    },
  });
  const productInfo = new Map(products.map((p) => [p.id, p]));
  const categoryLabels = await categoryLabelsById(
    products.map((product) => product.category.id),
  );

  const rows = Array.from(productMap.entries())
    .map(([productId, agg]) => {
      const info = productInfo.get(productId);
      const profit = money(agg.revenue - agg.cost);
      const margin =
        agg.revenue > 0 ? round2((profit / agg.revenue) * 100) : 0;
      return {
        productId,
        name: info?.name ?? "Deleted product",
        category:
          (info && categoryLabels.get(info.category.id)) ||
          info?.category?.name ||
          "—",
        categoryPath: info?.category?.path ?? null,
        unitsSold: agg.units,
        revenue: money(agg.revenue),
        cost: money(agg.cost),
        profit,
        margin,
        currentStock: info
          ? info.variants.reduce((sum, v) => sum + v.stock, 0)
          : null,
        status: info?.status ?? null,
      };
    })
    .sort((a, b) => b.profit - a.profit)
    .slice(0, limit);

  const totalRevenue = money(
    Array.from(productMap.values()).reduce((sum, b) => sum + b.revenue, 0),
  );
  const totalCost = money(
    Array.from(productMap.values()).reduce((sum, b) => sum + b.cost, 0),
  );
  const grossProfit = money(totalRevenue - totalCost);
  const unitsSold = Array.from(productMap.values()).reduce(
    (sum, b) => sum + b.units,
    0,
  );

  return {
    summary: {
      totalRevenue,
      totalCost,
      grossProfit,
      profitMargin: totalRevenue > 0 ? round2((grossProfit / totalRevenue) * 100) : 0,
      unitsSold,
      productsTracked: productMap.size,
    },
    rows,
  };
}

/* -------------------------------------------------------------------------- */
/*  5. Inventory report                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Inventory snapshot: low-stock and out-of-stock products plus a
 * full catalog list for the PDF. The window is ignored — inventory is
 * always reported "as of now".
 */
async function buildInventoryReport(limit: number) {
  // Pricing lives on the product; stock lives on its variants. Load each
  // product with its pricing + variant stock and aggregate per product.
  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      status: true,
      salePrice: true,
      discountPrice: true,
      category: { select: { id: true, name: true, path: true } },
      updatedAt: true,
      variants: {
        select: { stock: true },
      },
    },
  });

  type Row = {
    id: string;
    name: string;
    category: string;
    categoryPath: string;
    price: number;
    discountPrice: number | null;
    stock: number;
    status: (typeof products)[number]["status"];
    updatedAt: string;
  };

  const categoryLabels = await categoryLabelsById(
    products.map((product) => product.category.id),
  );

  let totalUnits = 0;
  let outOfStock = 0;
  let lowStock = 0;
  let inventoryValue = 0;

  const allRows: Row[] = products.map((p) => {
    const stock = p.variants.reduce((sum, v) => sum + v.stock, 0);
    const price = toNumber(p.salePrice);
    const sale = p.discountPrice != null ? toNumber(p.discountPrice) : null;
    const discountPrice = sale != null && sale < price ? sale : null;
    const unit = discountPrice != null ? discountPrice : price;

    totalUnits += stock;
    if (stock === 0) outOfStock += 1;
    else if (stock <= 5) lowStock += 1;

    // Inventory value uses the effective selling price * total stock.
    inventoryValue += unit * stock;

    return {
      id: p.id,
      name: p.name,
      category: categoryLabels.get(p.category.id) || p.category.name || "—",
      categoryPath: p.category.path,
      price: money(price),
      discountPrice: discountPrice != null ? money(discountPrice) : null,
      stock,
      status: p.status,
      updatedAt: p.updatedAt.toISOString(),
    };
  });

  const rows = allRows
    .sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name))
    .slice(0, limit);

  return {
    summary: {
      totalProducts: products.length,
      totalUnitsInStock: totalUnits,
      outOfStock,
      lowStock,
      inventoryValue: money(inventoryValue),
    },
    rows,
  };
}

/* -------------------------------------------------------------------------- */
/*  6. Customers report                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Customer behaviour: top spenders + new sign-ups in the window.
 * Cancelled orders are excluded from the spend numbers.
 */
async function buildCustomersReport(window: Window, limit: number) {
  const [newSignups, orderAggregates, totalUsers] = await Promise.all([
    prisma.user.count({
      where: { createdAt: { gte: window.from, lte: window.to } },
    }),
    prisma.order.groupBy({
      by: ["userId"],
      where: {
        currency: BASE_CURRENCY,
        createdAt: { gte: window.from, lte: window.to },
        status: { not: "CANCELLED" },
        // Guest orders contribute to sales and profit reports, but this is
        // specifically an account-customer behaviour report.
        userId: { not: null },
      },
      _sum: { totalAmount: true },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    prisma.user.count(),
  ]);

  if (orderAggregates.length === 0) {
    return {
      summary: {
        totalUsers,
        newSignupsInWindow: newSignups,
        activeBuyers: 0,
        totalRevenue: 0,
        avgRevenuePerBuyer: 0,
      },
      rows: [],
    };
  }

  const userIds = orderAggregates
    .map((row) => row.userId)
    .filter((id): id is string => id !== null);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true, phone: true, city: true, role: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  const rows = orderAggregates
    .map((row) => {
      const user = row.userId ? userMap.get(row.userId) : undefined;
      return {
        userId: row.userId,
        name: user?.name ?? "(deleted user)",
        email: user?.email ?? null,
        phone: user?.phone ?? null,
        city: user?.city ?? null,
        role: user?.role ?? "USER",
        ordersCount: row._count._all,
        totalSpend: money(row._sum.totalAmount ?? 0),
        lastOrderAt: row._max.createdAt
          ? row._max.createdAt.toISOString()
          : null,
      };
    })
    .sort((a, b) => b.totalSpend - a.totalSpend)
    .slice(0, limit);

  const totalRevenue = money(
    orderAggregates.reduce((sum, row) => sum + toNumber(row._sum.totalAmount), 0),
  );

  return {
    summary: {
      totalUsers,
      newSignupsInWindow: newSignups,
      activeBuyers: orderAggregates.length,
      totalRevenue,
      avgRevenuePerBuyer:
        orderAggregates.length > 0
          ? money(totalRevenue / orderAggregates.length)
          : 0,
    },
    rows,
  };
}

/* -------------------------------------------------------------------------- */
/*  7. Categories report                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Performance by category has two deliberate views:
 * - direct rows attribute products/sales only to the product's category;
 * - root rollups fold every direct row into exactly one top-level category.
 *
 * The headline totals come from all direct rows before the preview limit is
 * applied, so neither pagination nor the second rollup view can double count.
 */
async function buildCategoriesReport(window: Window, limit: number) {
  const categories = await prisma.category.findMany({
    select: {
      id: true,
      name: true,
      path: true,
      parentId: true,
      depth: true,
      status: true,
      _count: { select: { products: true } },
    },
    orderBy: [{ depth: "asc" }, { position: "asc" }, { name: "asc" }],
  });

  // Pull every order item in the window; small-shop catalog so a bulk
  // fetch is fine. If this grows, switch to a raw SQL aggregate.
  const items = await prisma.orderItem.findMany({
    where: {
      order: {
        currency: BASE_CURRENCY,
        createdAt: { gte: window.from, lte: window.to },
        status: { not: "CANCELLED" },
      },
    },
    select: {
      quantity: true,
      totalPrice: true,
      product: { select: { categoryId: true } },
    },
  });

  const aggregate = new Map<string, { units: number; revenue: number }>();
  for (const item of items) {
    // Skip items whose product was deleted — no category to attribute to.
    if (!item.product) continue;
    const key = item.product.categoryId;
    const bucket = aggregate.get(key) ?? { units: 0, revenue: 0 };
    bucket.units += item.quantity;
    bucket.revenue = round2(bucket.revenue + toNumber(item.totalPrice));
    aggregate.set(key, bucket);
  }

  const performance = buildCategoryPerformance(
    categories.map((category) => ({
      id: category.id,
      name: category.name,
      path: category.path,
      parentId: category.parentId,
      depth: category.depth,
      status: category.status,
      directProductCount: category._count.products,
    })),
    [...aggregate.entries()].map(([categoryId, stats]) => ({
      categoryId,
      unitsSold: stats.units,
      revenue: stats.revenue,
    })),
  );

  return {
    summary: {
      totalCategories: categories.length,
      activeCategories: categories.filter((c) => c.status === "ACTIVE").length,
      totalProducts: performance.totals.products,
      unitsSold: performance.totals.unitsSold,
      revenue: performance.totals.revenue,
    },
    rows: performance.rows.slice(0, limit),
    rootRollups: performance.rootRollups.slice(0, limit),
  };
}

/* -------------------------------------------------------------------------- */
/*  Public entry                                                              */
/* -------------------------------------------------------------------------- */

export type ReportPayload = Awaited<ReturnType<typeof buildReport>>;

export async function buildReport(query: ReportQueryInput) {
  // Current-price inventory/product comparisons must never label an unreviewed catalog USD.
  if (query.type === "inventory" || query.type === "products") {
    assertUsdPricingReady(await getStoreSettings());
  }
  const window = resolveWindow(query);
  const meta = {
    currency: BASE_CURRENCY,
    type: query.type,
    from: window.from.toISOString(),
    to: window.to.toISOString(),
    generatedAt: new Date().toISOString(),
    limit: query.limit,
    allTime: query.allTime,
  };

  switch (query.type) {
    case "sales":
      return { meta, sales: await buildSalesReport(window, query.limit) };
    case "orders":
      return { meta, orders: await buildOrdersReport(window, query.limit) };
    case "products":
      return { meta, products: await buildProductsReport(window, query.limit) };
    case "profit":
      return { meta, profit: await buildProfitReport(window, query.limit) };
    case "inventory":
      return { meta, inventory: await buildInventoryReport(query.limit) };
    case "customers":
      return { meta, customers: await buildCustomersReport(window, query.limit) };
    case "categories":
      return {
        meta,
        categories: await buildCategoriesReport(window, query.limit),
      };
    default:
      // Should be unreachable thanks to Zod, but keep TS happy.
      throw new ReportError(400, "Unknown report type.");
  }
}
