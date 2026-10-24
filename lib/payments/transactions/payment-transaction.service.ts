/**
 * Payment transaction ledger service.
 *
 * Moved from lib/services/payment-transaction.service.ts during the
 * payment module restructuring. Provides paginated transaction views
 * for both customers and administrators.
 */

import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";

import { prisma } from "@/lib/db/prisma";
import { toNumber } from "@/lib/money";
import type {
  AdminTransactionQueryInput,
  CustomerTransactionQueryInput,
} from "@/lib/payments/validation/payment-transaction.schema";

const customerTransactionSelect = {
  id: true,
  provider: true,
  transactionId: true,
  bankTransactionId: true,
  cardType: true,
  amount: true,
  currency: true,
  status: true,
  paidAt: true,
  requiresReview: true,
  createdAt: true,
  updatedAt: true,
  order: {
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentMethod: true,
      paymentStatus: true,
    },
  },
} satisfies Prisma.PaymentTransactionSelect;

const adminTransactionSelect = {
  ...customerTransactionSelect,
  riskLevel: true,
  reviewReason: true,
  reviewResolvedAt: true,
  reviewResolvedBy: true,
  reviewResolution: true,
  reviewResolutionReference: true,
  order: {
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentMethod: true,
      paymentStatus: true,
      customerName: true,
      customerEmail: true,
      customerPhone: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  },
} satisfies Prisma.PaymentTransactionSelect;

type CustomerTransactionRow = Prisma.PaymentTransactionGetPayload<{
  select: typeof customerTransactionSelect;
}>;
type AdminTransactionRow = Prisma.PaymentTransactionGetPayload<{
  select: typeof adminTransactionSelect;
}>;

function serializeCustomerTransaction(row: CustomerTransactionRow) {
  return {
    ...row,
    amount: toNumber(row.amount),
  };
}

function serializeAdminTransaction(row: AdminTransactionRow) {
  return {
    ...row,
    amount: toNumber(row.amount),
  };
}

function transactionFilters(
  query: CustomerTransactionQueryInput,
): Prisma.PaymentTransactionWhereInput {
  return {
    ...(query.status ? { status: query.status } : {}),
    ...(query.provider ? { provider: query.provider } : {}),
  };
}

function paginationMeta(
  page: number,
  pageSize: number,
  total: number,
) {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/**
 * Customer ledger. Ownership is part of the SQL relation filter, so no
 * transaction belonging to another account can enter the result set.
 */
export async function listTransactionsForUser(
  userId: string,
  query: CustomerTransactionQueryInput,
) {
  const where: Prisma.PaymentTransactionWhereInput = {
    ...transactionFilters(query),
    order: { userId },
  };
  return prisma.$transaction(
    async (tx) => {
      const total = await tx.paymentTransaction.count({ where });
      const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
      const page = Math.min(query.page, totalPages);
      const rows = await tx.paymentTransaction.findMany({
        where,
        select: customerTransactionSelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * query.pageSize,
        take: query.pageSize,
      });

      return {
        items: rows.map(serializeCustomerTransaction),
        meta: paginationMeta(page, query.pageSize, total),
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}

function adminTransactionWhere(
  query: AdminTransactionQueryInput,
): Prisma.PaymentTransactionWhereInput {
  const where: Prisma.PaymentTransactionWhereInput = {
    ...transactionFilters(query),
  };

  if (query.review === "OPEN") {
    where.requiresReview = true;
  } else if (query.review === "RESOLVED") {
    where.requiresReview = false;
    where.reviewResolvedAt = { not: null };
  }

  if (query.search) {
    where.OR = [
      { id: { contains: query.search, mode: "insensitive" } },
      { transactionId: { contains: query.search, mode: "insensitive" } },
      {
        bankTransactionId: {
          contains: query.search,
          mode: "insensitive",
        },
      },
      { provider: { contains: query.search, mode: "insensitive" } },
      { cardType: { contains: query.search, mode: "insensitive" } },
      {
        order: {
          orderNumber: {
            contains: query.search,
            mode: "insensitive",
          },
        },
      },
      {
        order: {
          customerName: {
            contains: query.search,
            mode: "insensitive",
          },
        },
      },
      {
        order: {
          customerEmail: {
            contains: query.search,
            mode: "insensitive",
          },
        },
      },
      {
        order: {
          customerPhone: {
            contains: query.search,
            mode: "insensitive",
          },
        },
      },
      {
        order: {
          user: {
            is: {
              name: {
                contains: query.search,
                mode: "insensitive",
              },
            },
          },
        },
      },
      {
        order: {
          user: {
            is: {
              email: {
                contains: query.search,
                mode: "insensitive",
              },
            },
          },
        },
      },
    ];
  }

  return where;
}

/** Complete admin ledger with operational review evidence, newest first. */
export async function listTransactionsForAdmin(
  query: AdminTransactionQueryInput,
) {
  const where = adminTransactionWhere(query);

  return prisma.$transaction(
    async (tx) => {
      const total = await tx.paymentTransaction.count({ where });
      const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
      const page = Math.min(query.page, totalPages);
      const rows = await tx.paymentTransaction.findMany({
        where,
        select: adminTransactionSelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * query.pageSize,
        take: query.pageSize,
      });

      return {
        items: rows.map(serializeAdminTransaction),
        meta: paginationMeta(page, query.pageSize, total),
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
