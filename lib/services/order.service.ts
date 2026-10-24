import "server-only";

import type { OrderStatus, Prisma } from "@/app/generated/prisma/client";
import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import {
  cleanVariantAttributes,
  formatVariantAttributes,
} from "@/lib/catalog/variant-options";
import { toNumber } from "@/lib/money";
import {
  CUSTOMER_CANCELLABLE_STATUSES,
  STATUS_TRANSITIONS,
} from "@/lib/orders/status";
import {
  gatewayPaymentBlocksCancellation,
  isGatewayManagedPaymentMethod,
  isNeverInitiatedAirwallexPayment,
  type CancellationPaymentSnapshot,
} from "@/lib/orders/payment-cancellation";
import {
  lockOrderForStatusChange,
  lockPaymentAttempt,
  recordStatusHistory,
  releasePromotionUsage,
  restoreStockForItems,
} from "@/lib/orders/mutations";
import { notifyOrderStatusChange } from "@/lib/orders/notifications";
import { ServiceError } from "@/lib/services/service-error";
import type {
  AdminOrderQueryInput,
  OrderQueryInput,
  UpdateOrderStatusInput,
  UpdatePaymentStatusInput,
} from "@/lib/validations/order.validation";
import { parseHistoricalCurrencyCode } from "@/lib/currency/config";
import { buildVerifiedPurchaseSnapshot } from "@/lib/analytics/order-purchase";
import { checkoutCustomerOwnsOrder, publicOrderFields, type CheckoutCustomer } from "@/lib/orders/checkout-customer";

/**
 * The single home for Order DB logic.
 *
 * Route handlers stay thin and these helpers stay reusable.
 * Domain rules live here:
 *   - prices and totals always come from the DB, never the client
 *   - stock is decremented atomically inside a transaction
 *   - cancellations restore stock in the same transaction
 *   - status transitions are validated centrally
 */

/* -------------------------------------------------------------------------- */
/*  Domain error                                                              */
/* -------------------------------------------------------------------------- */

/**
 * A typed error the service throws so route handlers can map it to
 * the right HTTP status without sprinkling try/catch heuristics.
 */
export class OrderError extends ServiceError {
  constructor(
    status: number,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(status, message, details);
    this.name = "OrderError";
  }
}

/* -------------------------------------------------------------------------- */
/*  Selects / shapes                                                          */
/* -------------------------------------------------------------------------- */

const orderItemInclude = {
  // Order items carry their own productName/productImage/sku snapshot,
  // so we only need the live product link for navigation (it may be null
  // if the product was deleted).
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      productCode: true,
    },
  },
} satisfies Prisma.OrderItemInclude;

const orderInclude = {
  items: { include: orderItemInclude },
  // Full audit trail, oldest first, so the customer tracker and admin
  // timeline render chronologically without a client-side sort.
  statusHistory: { orderBy: { createdAt: "asc" } },
  // Keep gateway evidence for verified analytics and the customer-facing
  // Airwallex payment quote, plus unresolved reviews from any provider.
  // Payment identifiers and raw evidence never cross the JSON boundary.
  payments: {
    where: {
      OR: [{ provider: { in: ["AIRWALLEX", "SSLCOMMERZ"] } }, { requiresReview: true }],
    },
    select: {
      provider: true,
      amount: true,
      currency: true,
      status: true,
      requiresReview: true,
      transactionId: true,
      validationId: true,
      providerStatus: true,
      paidAt: true,
      baseAmount: true,
      baseCurrency: true,
      exchangeRate: true,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  },
} satisfies Prisma.OrderInclude;

const orderWithUserInclude = {
  ...orderInclude,
  user: { select: { id: true, name: true, email: true, phone: true } },
} satisfies Prisma.OrderInclude;

export type OrderWithItems = Prisma.OrderGetPayload<{
  include: typeof orderInclude;
}>;
export type OrderWithItemsAndUser = Prisma.OrderGetPayload<{
  include: typeof orderWithUserInclude;
}>;

/* -------------------------------------------------------------------------- */
/*  Serialization (Decimal -> number for JSON responses)                      */
/* -------------------------------------------------------------------------- */

/**
 * Normalize an order row for the API: money Decimals become numbers and
 * each item is flattened to the snapshot shape the client expects
 * (productName/productImage/sku/unitPrice/totalPrice), with the live
 * product link kept (nullable) for navigation.
 */
function serializeOrderItem(item: OrderWithItems["items"][number]) {
  const variantAttributes = cleanVariantAttributes(item.variantAttributes);
  return {
    id: item.id,
    productId: item.productId,
    variantId: item.variantId,
    productName: item.productName,
    productImage: item.productImage,
    sku: item.sku,
    variantName: item.variantName,
    color: item.color,
    size: item.size,
    variantAttributes,
    attributeSummary: formatVariantAttributes(variantAttributes),
    quantity: item.quantity,
    unitPrice: toNumber(item.unitPrice),
    totalPrice: toNumber(item.totalPrice),
    displayUnitPrice: toNumber(item.displayUnitPrice),
    displayTotalPrice: toNumber(item.displayTotalPrice),
    product: item.product
      ? { id: item.product.id, name: item.product.name, slug: item.product.slug }
      : null,
  };
}

export function serializeOrder<T extends OrderWithItems>(order: T) {
  const { payments, ...rest } = publicOrderFields(order);
  return {
    ...rest,
    subtotal: toNumber(rest.subtotal),
    deliveryCharge: toNumber(rest.deliveryCharge),
    discountAmount: toNumber(rest.discountAmount),
    taxAmount: toNumber(rest.taxAmount),
    totalAmount: toNumber(rest.totalAmount),
    advancePayment: toNumber(rest.advancePayment),
    displaySubtotal: toNumber(rest.displaySubtotal),
    displayDeliveryCharge: toNumber(rest.displayDeliveryCharge),
    displayDiscountAmount: toNumber(rest.displayDiscountAmount),
    displayTaxAmount: toNumber(rest.displayTaxAmount),
    displayTotalAmount: toNumber(rest.displayTotalAmount),
    displayAdvancePayment: toNumber(rest.displayAdvancePayment),
    exchangeRate: rest.exchangeRate.toString(),
    exchangeRateTimestamp: rest.exchangeRateAt?.toISOString() ?? null,
    items: rest.items.map(serializeOrderItem),
    requiresPaymentReview: payments.some(
      (payment) => payment.requiresReview,
    ),
  };
}

function serializeCustomerOrderItem(
  item: OrderWithItems["items"][number],
  useDisplaySnapshot: boolean,
) {
  const canonical = serializeOrderItem(item);
  return {
    ...canonical,
    unitPrice: useDisplaySnapshot
      ? canonical.displayUnitPrice
      : canonical.unitPrice,
    totalPrice: useDisplaySnapshot
      ? canonical.displayTotalPrice
      : canonical.totalPrice,
    baseUnitPrice: canonical.unitPrice,
    baseTotalPrice: canonical.totalPrice,
  };
}

/**
 * Customer responses use the immutable display snapshot captured at checkout.
 * Canonical BDT values are returned explicitly for COD and reconciliation;
 * today's exchange-rate table is never consulted for historical orders.
 */
export function serializeCustomerOrder<T extends OrderWithItems>(order: T) {
  const { payments, ...rest } = publicOrderFields(order);
  const currency = parseHistoricalCurrencyCode(rest.displayCurrency) ?? parseHistoricalCurrencyCode(rest.currency) ?? "BDT";
  const baseCurrency = parseHistoricalCurrencyCode(rest.baseCurrency) ?? parseHistoricalCurrencyCode(rest.currency) ?? "BDT";
  const useDisplaySnapshot = true;
  const amount = (displayValue: Prisma.Decimal, baseValue: Prisma.Decimal) =>
    toNumber(displayValue ?? baseValue);

  const baseSubtotal = toNumber(rest.subtotal);
  const baseDeliveryCharge = toNumber(rest.deliveryCharge);
  const baseDiscountAmount = toNumber(rest.discountAmount);
  const baseTaxAmount = toNumber(rest.taxAmount);
  const baseTotalAmount = toNumber(rest.totalAmount);
  const baseAdvancePayment = toNumber(rest.advancePayment);
  const latestAirwallexPayment =
    rest.paymentMethod === "AIRWALLEX"
      ? (payments.find(
          (payment) =>
            payment.provider === "AIRWALLEX" &&
            ["SUCCESS", "REFUNDED"].includes(payment.status),
        ) ?? payments.find((payment) => payment.provider === "AIRWALLEX"))
      : undefined;
  const airwallexPaymentCurrency = latestAirwallexPayment
    ? parseHistoricalCurrencyCode(latestAirwallexPayment.currency.trim().toUpperCase())
    : null;

  return {
    ...rest,
    subtotal: amount(rest.displaySubtotal, rest.subtotal),
    deliveryCharge: amount(
      rest.displayDeliveryCharge,
      rest.deliveryCharge,
    ),
    discountAmount: amount(
      rest.displayDiscountAmount,
      rest.discountAmount,
    ),
    taxAmount: amount(rest.displayTaxAmount, rest.taxAmount),
    totalAmount: amount(rest.displayTotalAmount, rest.totalAmount),
    advancePayment: amount(
      rest.displayAdvancePayment,
      rest.advancePayment,
    ),
    currency,
    baseCurrency,
    paymentAmount:
      latestAirwallexPayment && airwallexPaymentCurrency
        ? toNumber(latestAirwallexPayment.amount)
        : null,
    paymentCurrency: airwallexPaymentCurrency ?? currency,
    baseSubtotal,
    baseDeliveryCharge,
    baseDiscountAmount,
    baseTaxAmount,
    baseTotalAmount,
    baseAdvancePayment,
    displaySubtotal: amount(rest.displaySubtotal, rest.subtotal),
    displayDeliveryCharge: amount(
      rest.displayDeliveryCharge,
      rest.deliveryCharge,
    ),
    displayDiscountAmount: amount(
      rest.displayDiscountAmount,
      rest.discountAmount,
    ),
    displayTaxAmount: amount(rest.displayTaxAmount, rest.taxAmount),
    displayTotalAmount: amount(rest.displayTotalAmount, rest.totalAmount),
    displayAdvancePayment: amount(
      rest.displayAdvancePayment,
      rest.advancePayment,
    ),
    exchangeRate: rest.exchangeRate.toString(),
    exchangeRateTimestamp: rest.exchangeRateAt?.toISOString() ?? null,
    items: rest.items.map((item) =>
      serializeCustomerOrderItem(item, useDisplaySnapshot),
    ),
    requiresPaymentReview: payments.some(
      (payment) => payment.requiresReview,
    ),
    metaPurchase: buildVerifiedPurchaseSnapshot(order),
  };
}

export function serializeCustomerOrderOrNull<T extends OrderWithItems>(
  order: T | null,
) {
  return order == null ? null : serializeCustomerOrder(order);
}

/* -------------------------------------------------------------------------- */
/*  Create order — removed                                                    */
/* -------------------------------------------------------------------------- */
//
// The legacy `createOrder` path (and its `resolveItems` /
// `effectiveProductPrice` / `generateOrderNumber` helpers) used to trust
// client-supplied `discountAmount`/`deliveryCharge`. It has been deleted.
// Order creation now goes exclusively through
// `checkout.service.placeOrder` (used by both `POST /api/orders` and
// `POST /api/checkout`), which recomputes every money value from the DB
// inside a single transaction.



/* -------------------------------------------------------------------------- */
/*  Customer reads                                                            */
/* -------------------------------------------------------------------------- */

export async function listMyOrders(userId: string, query: OrderQueryInput) {
  const where: Prisma.OrderWhereInput = {
    userId,
    ...(query.status ? { status: query.status } : {}),
  };
  const skip = (query.page - 1) * query.pageSize;

  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: query.pageSize,
      include: orderInclude,
    }),
    prisma.order.count({ where }),
  ]);

  return {
    items: items.map(serializeCustomerOrder),
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  };
}

/**
 * Fetch a single order, scoped to the user when `userId` is given.
 * The userId scope is part of the SQL `where` so unauthorized access
 * returns `null` (route maps it to 404) without leaking existence.
 */
export function getOrderForUser(orderId: string, userId: string) {
  return prisma.order
    .findFirst({
      where: { id: orderId, userId },
      include: orderInclude,
    })
    .then(serializeCustomerOrderOrNull);
}

/** An order-specific bearer cookie is required; contact matching is never used. */
export function getOrderForGuest(orderId: string, tokenHash: string) {
  return prisma.order.findFirst({
    where: { id: orderId, userId: null, guestAccessTokenHash: tokenHash },
    include: orderInclude,
  }).then(serializeCustomerOrderOrNull);
}

/** Internal checkout/payment replay read, scoped to the server identity. */
export async function getOrderForCheckoutCustomer(orderId: string, customer: CheckoutCustomer) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: orderInclude });
  return order && checkoutCustomerOwnsOrder(customer, order) ? serializeCustomerOrder(order) : null;
}

/**
 * Admin-authorized read for the customer-facing order page/API.
 *
 * Keep this separate from `getOrderForAdmin`: the admin endpoint returns the
 * canonical operational shape, while `/api/orders/[id]` must return the same
 * display/payment contract regardless of whether the viewer is the owner or
 * an administrator.
 */
export function getCustomerOrderViewForAdmin(orderId: string) {
  return prisma.order
    .findUnique({
      where: { id: orderId },
      include: orderInclude,
    })
    .then(serializeCustomerOrderOrNull);
}

/* -------------------------------------------------------------------------- */
/*  Cancellation                                                              */
/* -------------------------------------------------------------------------- */

const CUSTOMER_CANCELLABLE: readonly OrderStatus[] = CUSTOMER_CANCELLABLE_STATUSES;

/**
 * Fire a best-effort status-change notification for an already-committed
 * order. Kept outside the DB transaction so a delivery hiccup can't roll
 * back the status update; `notifyOrderStatusChange` itself never throws.
 */
async function fireStatusNotification(order: {
  orderNumber: string;
  status: OrderStatus;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  userId?: string | null;
}) {
  let localization:{locale?:string;catalog?:Record<string,unknown>}={};
  if(order.userId){
    try{
      const user=await prisma.user.findUnique({where:{id:order.userId},select:{preferredLocale:true}});
      if(user?.preferredLocale&&user.preferredLocale!=="en"){
        const [{getPublishedLanguages},{loadMessages}]=await Promise.all([import("@/lib/i18n/server"),import("@/lib/i18n/catalogs")]);
        const {normalizeLocale}=await import("@/lib/i18n/registry");const locale=normalizeLocale(user.preferredLocale);
        if(locale&&(await getPublishedLanguages()).some(language=>language.code===locale))localization={locale,catalog:await loadMessages(locale)};
      }
    }catch{/* Missing migration or preference lookup cannot block a committed order update. */}
  }
  await notifyOrderStatusChange({
    orderNumber: order.orderNumber,
    status: order.status,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    ...localization,
  });
}

/** Caller holds the order lock; preserve a ledger event for each unused reservation. */
async function cancelNeverInitiatedPayments(tx: Prisma.TransactionClient, payments: readonly (CancellationPaymentSnapshot & { id: string })[]): Promise<void> {
  for (const payment of payments.filter(isNeverInitiatedAirwallexPayment)) {
    await tx.paymentTransaction.update({
      where: { id: payment.id },
      data: {
        status: "CANCELLED",
        providerStatus: "LOCAL_CANCELLED",
        events: { create: {
          source: "INITIATION", eventName: "airwallex.reservation.cancelled",
          fromStatus: "CREATED", toStatus: "CANCELLED", providerStatus: "LOCAL_CANCELLED",
        } },
      },
    });
  }
}

export async function cancelOrderAsCustomer(orderId: string, userId: string) {
  const result = await prisma.$transaction(async (tx) => {
    await lockOrderForStatusChange(tx, orderId);
    const order = await tx.order.findFirst({
      where: { id: orderId, userId },
      include: {
        items: true,
        payments: {
          where: {
            provider: { in: ["SSLCOMMERZ", "AIRWALLEX"] },
          },
          select: {
            id: true,
            provider: true,
            status: true,
            transactionId: true,
            providerStatus: true,
            requiresReview: true,
          },
        },
      },
    });
    if (!order) throw new OrderError(404, "Order not found.");

    if (gatewayPaymentBlocksCancellation(order)) {
      throw new OrderError(
        409,
        "This online payment is active, succeeded, or requires investigation; cancellation is unavailable until the provider reaches a safe terminal state.",
      );
    }

    if (!CUSTOMER_CANCELLABLE.includes(order.status)) {
      throw new OrderError(
        409,
        `Order cannot be cancelled in its current status (${order.status}).`,
      );
    }

    await cancelNeverInitiatedPayments(tx, order.payments);
    // Restore stock for every line onto its variant.
    await restoreStockForItems(tx, order.items, order.orderNumber);
    await releasePromotionUsage(tx, order.id);
    if (order.paymentMethod === "SSLCOMMERZ") {
      await tx.paymentTransaction.updateMany({
        where: {
          orderId: order.id,
          provider: "SSLCOMMERZ",
          status: "PENDING",
        },
        data: { status: "CANCELLED" },
      });
    }

    const updated = await tx.order.update({
      where: { id: order.id },
      data: {
        status: "CANCELLED",
        ...(isGatewayManagedPaymentMethod(order.paymentMethod)
          ? { paymentStatus: "FAILED" as const }
          : {}),
      },
      include: orderInclude,
    });
    await recordStatusHistory(tx, order.id, "CANCELLED", {
      note: "Cancelled by customer.",
      updatedBy: userId,
    });
    return serializeCustomerOrder(updated);
  });

  await fireStatusNotification(result);
  return result;
}

/* -------------------------------------------------------------------------- */
/*  Admin reads                                                               */
/* -------------------------------------------------------------------------- */

function buildAdminWhere(query: AdminOrderQueryInput): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};

  if (query.status) where.status = query.status;
  if (query.paymentStatus) where.paymentStatus = query.paymentStatus;
  if (query.customerType === "GUEST") {
    where.guestCustomerId = { not: null };
  } else if (query.customerType === "REGISTERED") {
    where.userId = { not: null };
    where.guestCustomerId = null;
  }

  if (query.search) {
    where.OR = [
      { orderNumber: { contains: query.search, mode: "insensitive" } },
      { customerName: { contains: query.search, mode: "insensitive" } },
      { customerPhone: { contains: query.search, mode: "insensitive" } },
      { customerEmail: { contains: query.search, mode: "insensitive" } },
    ];
  }

  return where;
}

export async function listOrdersForAdmin(query: AdminOrderQueryInput) {
  const where = buildAdminWhere(query);
  const skip = (query.page - 1) * query.pageSize;

  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: query.pageSize,
      select: {
        id: true,
        orderNumber: true,
        userId: true,
        guestCustomerId: true,
        subtotal: true,
        deliveryCharge: true,
        discountAmount: true,
        totalAmount: true,
        advancePayment: true,
        status: true,
        paymentMethod: true,
        paymentStatus: true,
        payments: {
          where: {
            requiresReview: true,
          },
          select: { provider: true, status: true, reviewReason: true },
        },
        customerName: true,
        customerPhone: true,
        customerEmail: true,
        customerAddress: true,
        customerCity: true,
        customerArea: true,
        customerPostalCode: true,
        customerNote: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { id: true, name: true, email: true, phone: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  // Flatten `_count.items` and convert Decimal money fields to numbers.
  const items = rows.map((row) => {
    const { _count, payments, ...rest } = row;
    return {
      ...rest,
      subtotal: toNumber(rest.subtotal),
      deliveryCharge: toNumber(rest.deliveryCharge),
      discountAmount: toNumber(rest.discountAmount),
      totalAmount: toNumber(rest.totalAmount),
      advancePayment: toNumber(rest.advancePayment),
      itemsCount: _count.items,
      requiresPaymentReview: payments.length > 0,
      paymentReviewReasons: [
        ...new Set(
          payments.map(
            (payment) => payment.reviewReason ?? "UNSPECIFIED_REVIEW",
          ),
        ),
      ],
      paymentReviewApprovalAllowed:
        rest.paymentMethod === "SSLCOMMERZ" &&
        payments.length > 0 &&
        rest.paymentStatus === "PAID" &&
        !["CANCELLED", "REFUNDED"].includes(rest.status) &&
        payments.every((payment) => payment.status === "SUCCESS"),
      paymentReviewRefundCancellationAllowed:
        rest.paymentMethod === "SSLCOMMERZ" &&
        payments.length > 0 &&
        (["CANCELLED", "REFUNDED"].includes(rest.status) ||
          STATUS_TRANSITIONS[rest.status].includes("CANCELLED")),
    };
  });

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

/**
 * Cache layer over `listOrdersForAdmin`. Tagged `admin-orders` so any
 * status / payment / cancellation mutation can bust it on demand via
 * `revalidateTag("admin-orders", "max")`. Uses stale-while-revalidate
 * semantics so the admin panel stays responsive even if the DB is slow.
 */
const getCachedOrdersForAdmin = unstable_cache(
  async (query: AdminOrderQueryInput) => listOrdersForAdmin(query),
  ["admin-orders-list"],
  { revalidate: 300, tags: ["admin-orders"] },
);

export function listOrdersForAdminCached(query: AdminOrderQueryInput) {
  return getCachedOrdersForAdmin(query);
}

export function getOrderForAdmin(orderId: string) {
  return prisma.order
    .findUnique({
      where: { id: orderId },
      include: orderWithUserInclude,
    })
    .then((order) => (order == null ? null : serializeOrder(order)));
}

/* -------------------------------------------------------------------------- */
/*  Admin updates                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Update an order's status.
 *
 * Transition rules live in `@/lib/orders/status` (shared with the UI).
 * Stock is restored when an order leaves a live state into CANCELLED or
 * is RETURNED, and every change appends to the audit trail — all inside
 * one transaction so status, stock, and history can't drift apart.
 *
 * `updatedBy` is the admin id from the session (recorded in the trail).
 */
export async function updateOrderStatus(
  orderId: string,
  input: UpdateOrderStatusInput,
  updatedBy?: string | null,
) {
  const result = await prisma.$transaction(async (tx) => {
    await lockOrderForStatusChange(tx, orderId);
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        payments: {
          where: {
            provider: { in: ["SSLCOMMERZ", "AIRWALLEX"] },
          },
          select: {
            id: true,
            provider: true,
            status: true,
            transactionId: true,
            providerStatus: true,
            requiresReview: true,
          },
        },
      },
    });
    if (!order) throw new OrderError(404, "Order not found.");

    const next = input.status;
    if (next === order.status) {
      throw new OrderError(409, `Order is already ${next}.`);
    }

    const requiresPaymentReview = order.payments.some(
      (payment) => payment.requiresReview,
    );
    if (
      isGatewayManagedPaymentMethod(order.paymentMethod) &&
      requiresPaymentReview
    ) {
      throw new OrderError(
        409,
        "This payment requires fraud or operations review before fulfillment.",
      );
    }
    if (
      isGatewayManagedPaymentMethod(order.paymentMethod) &&
      next === "PAYMENT_CONFIRMED" &&
      order.paymentStatus !== "PAID"
    ) {
      throw new OrderError(
        409,
        "Online orders can be confirmed only after verified gateway payment.",
      );
    }
    if (
      isGatewayManagedPaymentMethod(order.paymentMethod) &&
      next === "CANCELLED" &&
      gatewayPaymentBlocksCancellation(order)
    ) {
      throw new OrderError(
        409,
        "An active or paid online payment must reach a safe provider terminal state before cancellation.",
      );
    }

    const allowed = STATUS_TRANSITIONS[order.status];
    if (!allowed.includes(next)) {
      throw new OrderError(
        409,
        `Cannot change status from ${order.status} to ${next}.`,
      );
    }

    // Restore stock when an order moves out of a live state: an admin
    // cancellation or a completed return both put the units back.
    if (next === "CANCELLED" || next === "RETURNED") {
      await restoreStockForItems(tx, order.items, order.orderNumber);
      if (next === "CANCELLED") {
        await cancelNeverInitiatedPayments(tx, order.payments);
        await releasePromotionUsage(tx, order.id);
      }
      if (
        next === "CANCELLED" &&
        order.paymentMethod === "SSLCOMMERZ"
      ) {
        await tx.paymentTransaction.updateMany({
          where: {
            orderId: order.id,
            provider: "SSLCOMMERZ",
            status: "PENDING",
          },
          data: { status: "CANCELLED" },
        });
      }
    }

    const updated = await tx.order.update({
      where: { id: order.id },
      data: {
        status: next,
        ...(next === "CANCELLED" &&
        isGatewayManagedPaymentMethod(order.paymentMethod)
          ? { paymentStatus: "FAILED" as const }
          : {}),
      },
      include: orderWithUserInclude,
    });
    await recordStatusHistory(tx, order.id, next, {
      note: input.note ?? null,
      updatedBy: updatedBy ?? null,
    });
    return serializeOrder(updated);
  });

  await fireStatusNotification(result);
  return result;
}

/**
 * Historical records only: resolve a successful SSLCommerz payment hold after an authenticated admin
 * has completed the provider/fraud review.
 *
 * The provider already proved payment, so this never changes payment amount,
 * identifiers, or SUCCESS state. It only records who approved the hold and
 * advances a still-pending order to PAYMENT_CONFIRMED. All provider writers
 * take the same order -> payment locks, preventing a new risk event from being
 * lost behind the approval.
 */
export async function approveSslCommerzPaymentReview(
  orderId: string,
  updatedBy: string,
) {
  return prisma.$transaction(async (tx) => {
    await lockOrderForStatusChange(tx, orderId);

    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        payments: {
          where: { provider: "SSLCOMMERZ", requiresReview: true },
          select: { id: true, status: true, requiresReview: true },
          orderBy: { id: "asc" },
        },
      },
    });
    if (!order) throw new OrderError(404, "Order not found.");
    if (order.paymentMethod !== "SSLCOMMERZ") {
      throw new OrderError(
        409,
        "Only an SSLCommerz order can have a payment review approved.",
      );
    }
    if (["CANCELLED", "REFUNDED"].includes(order.status)) {
      throw new OrderError(
        409,
        "A terminal order requires a verified refund workflow, not payment-review approval.",
      );
    }

    const reviewedPayments = order.payments.filter(
      (payment) => payment.requiresReview,
    );
    if (reviewedPayments.length === 0) {
      throw new OrderError(409, "This order has no unresolved payment review.");
    }
    if (
      order.paymentStatus !== "PAID" ||
      reviewedPayments.some((payment) => payment.status !== "SUCCESS")
    ) {
      throw new OrderError(
        409,
        "This hold is a gateway verification anomaly and requires payment/refund investigation; it cannot be approved for fulfillment.",
      );
    }

    for (const payment of reviewedPayments) {
      await lockPaymentAttempt(tx, payment.id);
    }

    const resolvedAt = new Date();
    const resolved = await tx.paymentTransaction.updateMany({
      where: {
        id: { in: reviewedPayments.map((payment) => payment.id) },
        provider: "SSLCOMMERZ",
        status: "SUCCESS",
        requiresReview: true,
      },
      data: {
        requiresReview: false,
        reviewResolvedAt: resolvedAt,
        reviewResolvedBy: updatedBy,
        reviewResolution: "APPROVED",
        reviewResolutionReference: null,
      },
    });
    if (resolved.count !== reviewedPayments.length) {
      throw new OrderError(
        409,
        "Payment review state changed. Refresh the order and try again.",
      );
    }

    const nextStatus =
      order.status === "PENDING" ? "PAYMENT_CONFIRMED" : order.status;
    const updated = await tx.order.update({
      where: { id: order.id },
      data:
        nextStatus === order.status
          ? {}
          : { status: "PAYMENT_CONFIRMED" as const },
      include: orderWithUserInclude,
    });
    await recordStatusHistory(tx, order.id, nextStatus, {
      note:
        nextStatus === order.status
          ? "SSLCommerz payment review approved; fulfillment hold removed."
          : "SSLCommerz payment review approved and payment confirmed.",
      updatedBy,
    });

    return serializeOrder(updated);
  });
}

/**
 * Historical records only: record a refund already verified in the former provider
 * back office, then release/cancel the reserved order exactly once.
 *
 * This does not call or pretend to initiate a refund. The required external
 * reference, actor, and timestamp are retained on each affected payment row.
 */
export async function recordSslCommerzRefundAndCancel(
  orderId: string,
  refundReference: string,
  updatedBy: string,
) {
  return prisma.$transaction(async (tx) => {
    await lockOrderForStatusChange(tx, orderId);

    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        payments: {
          where: {
            provider: "SSLCOMMERZ",
            OR: [
              { requiresReview: true },
              { status: { in: ["PENDING", "SUCCESS"] } },
            ],
          },
          select: { id: true, status: true, requiresReview: true },
          orderBy: { id: "asc" },
        },
      },
    });
    if (!order) throw new OrderError(404, "Order not found.");
    if (order.paymentMethod !== "SSLCOMMERZ") {
      throw new OrderError(
        409,
        "Only an SSLCommerz order can record a provider refund resolution.",
      );
    }
    if (!order.payments.some((payment) => payment.requiresReview)) {
      throw new OrderError(409, "This order has no unresolved payment review.");
    }

    const alreadyCancelled = order.status === "CANCELLED";
    const alreadyRefunded = order.status === "REFUNDED";
    const canCancel = STATUS_TRANSITIONS[order.status].includes("CANCELLED");
    if (!alreadyCancelled && !alreadyRefunded && !canCancel) {
      throw new OrderError(
        409,
        "This order can no longer be cancelled through the payment-review workflow.",
      );
    }

    for (const payment of order.payments) {
      await lockPaymentAttempt(tx, payment.id);
    }

    const resolvedAt = new Date();
    const resolved = await tx.paymentTransaction.updateMany({
      where: {
        id: { in: order.payments.map((payment) => payment.id) },
        provider: "SSLCOMMERZ",
      },
      data: {
        status: "REFUNDED",
        requiresReview: false,
        reviewResolvedAt: resolvedAt,
        reviewResolvedBy: updatedBy,
        reviewResolution: "REFUND_CONFIRMED",
        reviewResolutionReference: refundReference,
      },
    });
    if (resolved.count !== order.payments.length) {
      throw new OrderError(
        409,
        "Payment review state changed. Refresh the order and try again.",
      );
    }

    const shouldCancel = !alreadyCancelled && !alreadyRefunded;
    const affectedProductIds = shouldCancel
      ? order.items.flatMap((item) =>
          item.productId ? [item.productId] : [],
        )
      : [];
    if (shouldCancel) {
      await restoreStockForItems(tx, order.items, order.orderNumber);
      await releasePromotionUsage(tx, order.id);
    }

    const nextStatus = shouldCancel ? "CANCELLED" : order.status;
    const updated = await tx.order.update({
      where: { id: order.id },
      data: {
        status: nextStatus,
        paymentStatus: "REFUNDED",
      },
      include: orderWithUserInclude,
    });
    await recordStatusHistory(tx, order.id, nextStatus, {
      note:
        "Externally confirmed SSLCommerz refund recorded; payment review resolved.",
      updatedBy,
    });

    return {
      order: serializeOrder(updated),
      affectedProductIds,
    };
  });
}

export async function updatePaymentStatus(
  orderId: string,
  input: UpdatePaymentStatusInput,
) {
  const existing = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, paymentMethod: true, paymentStatus: true },
  });
  if (!existing) throw new OrderError(404, "Order not found.");

  if (isGatewayManagedPaymentMethod(existing.paymentMethod)) {
    throw new OrderError(
      409,
      "Online payment status is controlled by verified gateway notifications.",
    );
  }

  if (existing.paymentStatus === input.paymentStatus) {
    throw new OrderError(409, `Payment is already ${input.paymentStatus}.`);
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { paymentStatus: input.paymentStatus },
    include: orderWithUserInclude,
  });
  return serializeOrder(updated);
}
