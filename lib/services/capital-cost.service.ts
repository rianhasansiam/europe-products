import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";

import { BASE_CURRENCY } from "@/lib/currency/config";
import { assertUsdPricingReady } from "@/lib/currency/pricing-readiness";
import { getStoreSettings } from "@/lib/services/settings.service";
import { prisma } from "@/lib/db/prisma";
import {
  multiply,
  round2,
  sumDecimals,
  toDecimal,
  toNumber,
} from "@/lib/money";
import { ServiceError } from "@/lib/services/service-error";
import type {
  AddCapitalInput,
  AddProductCostsInput,
  CreateOtherCostInput,
  OtherCostQueryInput,
  UpdateOtherCostInput,
} from "@/lib/validations/capital-cost.validation";

/**
 * Admin Capital & Cost Tracker — DB logic.
 *
 * Fully isolated from order and revenue mutations. It records only the
 * admin's product-cost selections, then reads product data to calculate
 * (buyingPrice × on-hand stock) used purely for display. It never writes
 * to Product/Order/etc. and never exposes `buyingPrice` to customers
 * (these endpoints are admin-guarded).
 *
 * `AdminCapital` is an append-only ledger: each "add capital" creates a
 * new row, and total capital is the sum of every contribution. Capital is
 * never edited or overwritten.
 */

/** The admin who performed an action, snapshotted onto the activity feed. */
export type ActivityActor = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
};

/* -------------------------------------------------------------------------- */
/*  Serialized shapes (Decimal → number at the JSON boundary)                 */
/* -------------------------------------------------------------------------- */

export type SerializedCapital = {
  id: string;
  amount: number;
  currency: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SerializedOtherCost = {
  id: string;
  amount: number;
  currency: string;
  reason: string;
  description: string | null;
  costDate: string;
  createdAt: string;
  updatedAt: string;
};

export type ProductCostSummary = {
  totalProductCost: number;
  productCount: number;
  totalUnits: number;
  items: ProductCostItem[];
};

export type ProductCostItem = {
  /** ID of the admin's explicit product-cost selection. */
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  status: "ACTIVE" | "INACTIVE";
  buyingPrice: number;
  totalUnits: number;
  totalCost: number;
  selectedAt: string;
};

export type ProductCostOption = {
  id: string;
  productCode: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
  buyingPrice: number;
  totalUnits: number;
  totalCost: number;
};

export type CapitalCostSummary = {
  totalCapital: number;
  productCosts: number;
  otherCosts: number;
  allCosts: number;
  remainingBalance: number;
};

export type CapitalCostActivityKind =
  | "CAPITAL_SET"
  | "CAPITAL_UPDATED"
  | "CAPITAL_ADDED"
  | "PRODUCT_COST_ADDED"
  | "PRODUCT_COST_REMOVED"
  | "COST_CREATED"
  | "COST_UPDATED"
  | "COST_DELETED";

export type SerializedActivity = {
  id: string;
  type: CapitalCostActivityKind;
  description: string;
  amount: number | null;
  currency: string;
  note: string | null;
  entityId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  createdAt: string;
};

export type CapitalCostOverview = {
  capital: SerializedCapital | null;
  productCost: ProductCostSummary;
  otherCosts: { items: SerializedOtherCost[]; total: number };
  summary: CapitalCostSummary;
  activity: SerializedActivity[];
};

/* -------------------------------------------------------------------------- */
/*  Selects + serializers                                                     */
/* -------------------------------------------------------------------------- */

const capitalSelect = {
  id: true,
  amount: true,
  currency: true,
  note: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AdminCapitalSelect;

const otherCostSelect = {
  id: true,
  amount: true,
  currency: true,
  reason: true,
  description: true,
  costDate: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AdminOtherCostSelect;

function serializeCapital(row: {
  id: string;
  amount: Prisma.Decimal;
  currency: string;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}): SerializedCapital {
  return {
    id: row.id,
    amount: toNumber(row.amount),
    currency: row.currency,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeOtherCost(row: {
  id: string;
  amount: Prisma.Decimal;
  currency: string;
  reason: string;
  description: string | null;
  costDate: Date;
  createdAt: Date;
  updatedAt: Date;
}): SerializedOtherCost {
  return {
    id: row.id,
    amount: toNumber(row.amount),
    currency: row.currency,
    reason: row.reason,
    description: row.description,
    costDate: row.costDate.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/* -------------------------------------------------------------------------- */
/*  Activity log (append-only)                                                */
/* -------------------------------------------------------------------------- */

const activitySelect = {
  id: true,
  type: true,
  description: true,
  amount: true,
  currency: true,
  note: true,
  entityId: true,
  actorName: true,
  actorEmail: true,
  createdAt: true,
} satisfies Prisma.AdminCapitalCostActivitySelect;

function serializeActivity(row: {
  id: string;
  type: CapitalCostActivityKind;
  description: string;
  amount: Prisma.Decimal | null;
  currency: string;
  note: string | null;
  entityId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  createdAt: Date;
}): SerializedActivity {
  return {
    id: row.id,
    type: row.type,
    description: row.description,
    amount: row.amount == null ? null : toNumber(row.amount),
    currency: row.currency,
    note: row.note,
    entityId: row.entityId,
    actorName: row.actorName,
    actorEmail: row.actorEmail,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Compact USD string for new activity descriptions. */
function formatMoney(value: number): string {
  const rounded = round2(value);
  return `${BASE_CURRENCY} ${rounded.toLocaleString("en-US", {
    minimumFractionDigits: Math.abs(rounded % 1) > 0.0001 ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Record an action on this page. Best-effort: a logging failure must
 * never roll back the actual mutation the admin performed, so callers
 * swallow errors from here.
 */
async function logActivity(entry: {
  type: CapitalCostActivityKind;
  description: string;
  amount?: number | null;
  note?: string | null;
  entityId?: string | null;
  actor?: ActivityActor | null;
}): Promise<void> {
  try {
    await prisma.adminCapitalCostActivity.create({
      data: {
        currency: BASE_CURRENCY,
        type: entry.type,
        description: entry.description,
        amount: entry.amount ?? null,
        note: entry.note ?? null,
        entityId: entry.entityId ?? null,
        actorId: entry.actor?.id ?? null,
        actorName: entry.actor?.name ?? null,
        actorEmail: entry.actor?.email ?? null,
      },
    });
  } catch (error) {
    console.error("[admin.capital-costs.activity] log failed", error);
  }
}

/** Most recent activity entries, newest first. */
export async function listRecentActivity(
  limit = 20,
): Promise<SerializedActivity[]> {
  const rows = await prisma.adminCapitalCostActivity.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: activitySelect,
  });
  return rows.map(serializeActivity);
}

/* -------------------------------------------------------------------------- */
/*  Capital (append-only ledger)                                              */
/* -------------------------------------------------------------------------- */

/** Total capital (sum of every contribution) + the latest contribution. */
async function readCapital(): Promise<{
  total: number;
  latest: SerializedCapital | null;
}> {
  const [rows, latest] = await Promise.all([
    prisma.adminCapital.findMany({ where: { currency: BASE_CURRENCY }, select: { amount: true } }),
    prisma.adminCapital.findFirst({
      where: { currency: BASE_CURRENCY },
      orderBy: { createdAt: "desc" },
      select: capitalSelect,
    }),
  ]);

  return {
    total: round2(sumDecimals(rows.map((row) => row.amount))),
    latest: latest ? serializeCapital(latest) : null,
  };
}

/**
 * The most recent capital contribution, or `null` when none exists yet.
 * Used for the "has capital" check; the headline figure is the *sum* of
 * all contributions (see the overview).
 */
export async function getCapital(): Promise<SerializedCapital | null> {
  return (await readCapital()).latest;
}

/**
 * Add a capital contribution. Append-only — every call creates a new row
 * and the running total grows by `input.amount`. Capital is never edited
 * or overwritten.
 */
export async function addCapital(
  input: AddCapitalInput,
  actor?: ActivityActor,
): Promise<SerializedCapital> {
  const created = await prisma.adminCapital.create({
    data: { currency: BASE_CURRENCY, amount: input.amount, note: input.note ?? null },
    select: capitalSelect,
  });

  await logActivity({
    type: "CAPITAL_ADDED",
    description: `Added ${formatMoney(created.amount.toNumber())} to capital`,
    amount: created.amount.toNumber(),
    note: created.note,
    entityId: created.id,
    actor,
  });

  return serializeCapital(created);
}

/* -------------------------------------------------------------------------- */
/*  Product costs (explicit admin selections)                                 */
/* -------------------------------------------------------------------------- */

/**
 * Derive capital tied up in inventory: for each product,
 * `buyingPrice × (sum of its variant stock)`. Purely informational — no
 * writes, and never persisted into this feature's tables. `productCount`
 * reports the full catalog count; zero-stock products still count as
 * products even though they contribute no units or inventory cost.
 */
type CostProduct = {
  id: string;
  productCode: string;
  name: string;
  status: string;
  buyingPrice: Prisma.Decimal;
  variants: { stock: number }[];
};

function productInventoryValue(product: CostProduct): {
  totalUnits: number;
  totalCost: number;
} {
  const totalUnits = product.variants.reduce(
    (sum, variant) => sum + variant.stock,
    0,
  );

  return {
    totalUnits,
    totalCost: round2(multiply(product.buyingPrice, Math.max(0, totalUnits))),
  };
}

function productStatus(status: string): "ACTIVE" | "INACTIVE" {
  return status === "INACTIVE" ? "INACTIVE" : "ACTIVE";
}

function serializeProductCost(row: {
  id: string;
  createdAt: Date;
  product: CostProduct;
}): ProductCostItem {
  const { totalUnits, totalCost } = productInventoryValue(row.product);

  return {
    id: row.id,
    productId: row.product.id,
    productCode: row.product.productCode,
    productName: row.product.name,
    status: productStatus(row.product.status),
    buyingPrice: toNumber(row.product.buyingPrice),
    totalUnits,
    totalCost,
    selectedAt: row.createdAt.toISOString(),
  };
}

/** List catalog products as candidates for the admin-only picker. */
export async function listProductCostOptions(): Promise<ProductCostOption[]> {
  assertUsdPricingReady(await getStoreSettings());
  const products = await prisma.product.findMany({
    orderBy: [{ name: "asc" }, { productCode: "asc" }],
    select: {
      id: true,
      productCode: true,
      name: true,
      status: true,
      buyingPrice: true,
      variants: { select: { stock: true } },
    },
  });

  return products.map((product) => {
    const { totalUnits, totalCost } = productInventoryValue(product);
    return {
      id: product.id,
      productCode: product.productCode,
      name: product.name,
      status: productStatus(product.status),
      buyingPrice: toNumber(product.buyingPrice),
      totalUnits,
      totalCost,
    };
  });
}

/**
 * Return costs for products that an admin explicitly added to this page.
 * Catalog products do not contribute a cost until selected.
 */
export async function getProductCost(): Promise<ProductCostSummary> {
  assertUsdPricingReady(await getStoreSettings());
  const rows = await prisma.adminProductCost.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      product: {
        select: {
          id: true,
          productCode: true,
          name: true,
          status: true,
          buyingPrice: true,
          variants: { select: { stock: true } },
        },
      },
    },
  });

  const items = rows.map(serializeProductCost);
  return {
    totalProductCost: round2(sumDecimals(items.map((item) => item.totalCost))),
    productCount: items.length,
    totalUnits: items.reduce((sum, item) => sum + item.totalUnits, 0),
    items,
  };
}

/** Add one or more product-cost cards, ignoring products already selected. */
export async function addProductCosts(
  input: AddProductCostsInput,
  actor?: ActivityActor,
): Promise<ProductCostSummary> {
  assertUsdPricingReady(await getStoreSettings());
  const products = await prisma.product.findMany({
    where: { id: { in: input.productIds } },
    select: {
      id: true,
      productCode: true,
      name: true,
      status: true,
      buyingPrice: true,
      variants: { select: { stock: true } },
    },
  });

  if (products.length !== input.productIds.length) {
    throw new ServiceError(404, "One or more selected products no longer exist.");
  }

  const existing = await prisma.adminProductCost.findMany({
    where: { productId: { in: input.productIds } },
    select: { productId: true },
  });
  const existingIds = new Set(existing.map((row) => row.productId));
  const productsToAdd = products.filter((product) => !existingIds.has(product.id));

  if (productsToAdd.length > 0) {
    await prisma.adminProductCost.createMany({
      data: productsToAdd.map((product) => ({ productId: product.id })),
      skipDuplicates: true,
    });

    await Promise.all(
      productsToAdd.map((product) => {
        const { totalCost } = productInventoryValue(product);
        return logActivity({
          type: "PRODUCT_COST_ADDED",
          description: `Added product cost for "${product.name}"`,
          amount: totalCost,
          note: product.productCode,
          entityId: product.id,
          actor,
        });
      }),
    );
  }

  return getProductCost();
}

/** Remove a product from the selected product-cost cards. */
export async function removeProductCost(
  id: string,
  actor?: ActivityActor,
): Promise<{ id: string }> {
  assertUsdPricingReady(await getStoreSettings());
  try {
    const row = await prisma.adminProductCost.delete({
      where: { id },
      select: {
        id: true,
        createdAt: true,
        product: {
          select: {
            id: true,
            productCode: true,
            name: true,
            status: true,
            buyingPrice: true,
            variants: { select: { stock: true } },
          },
        },
      },
    });
    const item = serializeProductCost(row);
    await logActivity({
      type: "PRODUCT_COST_REMOVED",
      description: `Removed product cost for "${item.productName}"`,
      amount: item.totalCost,
      note: item.productCode,
      entityId: row.id,
      actor,
    });
    return { id };
  } catch (error) {
    if (
      error instanceof PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new ServiceError(404, "Selected product cost not found.");
    }
    throw error;
  }
}

/* -------------------------------------------------------------------------- */
/*  Other costs (CRUD)                                                        */
/* -------------------------------------------------------------------------- */

function buildOtherCostWhere(
  query: Partial<OtherCostQueryInput>,
): Prisma.AdminOtherCostWhereInput {
  const where: Prisma.AdminOtherCostWhereInput = {};

  if (query.search) {
    where.OR = [
      { reason: { contains: query.search, mode: "insensitive" } },
      { description: { contains: query.search, mode: "insensitive" } },
    ];
  }

  if (query.dateFrom || query.dateTo) {
    const costDate: Prisma.DateTimeFilter = {};
    if (query.dateFrom) costDate.gte = query.dateFrom;
    if (query.dateTo) {
      // The picker yields a midnight Date; include the whole day.
      const end = new Date(query.dateTo);
      end.setHours(23, 59, 59, 999);
      costDate.lte = end;
    }
    where.costDate = costDate;
  }

  if (query.minAmount !== undefined || query.maxAmount !== undefined) {
    const amount: Prisma.DecimalFilter = {};
    if (query.minAmount !== undefined) amount.gte = query.minAmount;
    if (query.maxAmount !== undefined) amount.lte = query.maxAmount;
    where.amount = amount;
  }

  return where;
}

/**
 * List manual "other costs" with optional filtering. Returns the matched
 * rows plus the exact (Decimal-safe) sum of their amounts so the UI can
 * show a "filtered total" without re-summing client-side floats.
 */
export async function listOtherCosts(query: OtherCostQueryInput): Promise<{
  items: SerializedOtherCost[];
  total: number;
  filteredTotalAmount: number;
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}> {
  const where = buildOtherCostWhere(query);
  const skip = (query.page - 1) * query.pageSize;

  const [rows, count, amountRows] = await Promise.all([
    prisma.adminOtherCost.findMany({
      where,
      orderBy: [{ costDate: "desc" }, { createdAt: "desc" }],
      skip,
      take: query.pageSize,
      select: otherCostSelect,
    }),
    prisma.adminOtherCost.count({ where }),
    prisma.adminOtherCost.findMany({ where: { AND: [where, { currency: BASE_CURRENCY }] }, select: { amount: true } }),
  ]);

  const filteredTotalAmount = round2(
    sumDecimals(amountRows.map((row) => row.amount)),
  );

  return {
    items: rows.map(serializeOtherCost),
    total: count,
    filteredTotalAmount,
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total: count,
      totalPages: Math.max(1, Math.ceil(count / query.pageSize)),
    },
  };
}

export async function createOtherCost(
  input: CreateOtherCostInput,
  actor?: ActivityActor,
): Promise<SerializedOtherCost> {
  const row = await prisma.adminOtherCost.create({
    data: {
      currency: BASE_CURRENCY,
      amount: input.amount,
      reason: input.reason,
      description: input.description ?? null,
      costDate: input.costDate,
    },
    select: otherCostSelect,
  });
  await logActivity({
    type: "COST_CREATED",
    description: `Added cost "${row.reason}" for ${formatMoney(row.amount.toNumber())}`,
    amount: row.amount.toNumber(),
    note: row.reason,
    entityId: row.id,
    actor,
  });
  return serializeOtherCost(row);
}

export async function updateOtherCost(
  id: string,
  input: UpdateOtherCostInput,
  actor?: ActivityActor,
): Promise<SerializedOtherCost> {
  const data: Prisma.AdminOtherCostUpdateInput = {};
  if (input.amount !== undefined) data.amount = input.amount;
  if (input.reason !== undefined) data.reason = input.reason;
  if (input.description !== undefined) data.description = input.description;
  if (input.costDate !== undefined) data.costDate = input.costDate;

  try {
    const row = await prisma.adminOtherCost.update({
      where: { id, currency: BASE_CURRENCY },
      data,
      select: otherCostSelect,
    });
    await logActivity({
      type: "COST_UPDATED",
      description: `Updated cost "${row.reason}" (${formatMoney(row.amount.toNumber())})`,
      amount: row.amount.toNumber(),
      note: row.reason,
      entityId: row.id,
      actor,
    });
    return serializeOtherCost(row);
  } catch (error) {
    if (
      error instanceof PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new ServiceError(404, "Cost record not found.");
    }
    throw error;
  }
}

export async function deleteOtherCost(
  id: string,
  actor?: ActivityActor,
): Promise<{ id: string }> {
  try {
    const row = await prisma.adminOtherCost.delete({
      where: { id, currency: BASE_CURRENCY },
      select: otherCostSelect,
    });
    await logActivity({
      type: "COST_DELETED",
      description: `Deleted cost "${row.reason}" (${formatMoney(row.amount.toNumber())})`,
      amount: row.amount.toNumber(),
      note: row.reason,
      entityId: row.id,
      actor,
    });
    return { id };
  } catch (error) {
    if (
      error instanceof PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new ServiceError(404, "Cost record not found.");
    }
    throw error;
  }
}

/* -------------------------------------------------------------------------- */
/*  Overview (cards + capital + first page of costs)                          */
/* -------------------------------------------------------------------------- */

/**
 * One-shot snapshot for the page: capital, selected product costs, the
 * (unfiltered) other-cost list, and the headline summary numbers. All
 * money math flows through Decimal helpers and is rounded once at the end.
 */
export async function getCapitalCostOverview(): Promise<CapitalCostOverview> {
  const [capitalState, productCost, otherList] = await Promise.all([
    readCapital(),
    getProductCost(),
    listOtherCosts({ page: 1, pageSize: 200 }),
  ]);

  const totalCapital = capitalState.total;
  const productCosts = productCost.totalProductCost;
  const otherCosts = otherList.filteredTotalAmount;
  const allCosts = round2(toDecimal(productCosts).plus(toDecimal(otherCosts)));
  const remainingBalance = round2(
    toDecimal(totalCapital).minus(toDecimal(allCosts)),
  );

  const activity = await listRecentActivity(20);

  return {
    capital: capitalState.latest,
    productCost,
    otherCosts: { items: otherList.items, total: otherCosts },
    summary: {
      totalCapital,
      productCosts,
      otherCosts,
      allCosts,
      remainingBalance,
    },
    activity,
  };
}
