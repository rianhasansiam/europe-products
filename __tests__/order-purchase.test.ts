import { beforeEach, describe, expect, it, vi } from "vitest";
import { Decimal } from "@prisma/client/runtime/client";

vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));
const purchaseDelivery = vi.hoisted(() => ({
  hasPurchaseIntent: vi.fn(), trackPurchase: vi.fn(),
}));
vi.mock("@/lib/analytics/meta-pixel", () => purchaseDelivery);

import { buildVerifiedPurchaseSnapshot } from "@/lib/analytics/order-purchase";
import { trackPendingOrderPurchase } from "@/lib/analytics/order-purchase-browser";

type PurchaseOrder = Parameters<typeof buildVerifiedPurchaseSnapshot>[0];

function paidOrder(method = "SSLCOMMERZ"): PurchaseOrder {
  return {
    id: "order-verified",
    userId: "owner-1",
    status: "PAYMENT_CONFIRMED",
    paymentMethod: method,
    paymentStatus: "PAID",
    totalAmount: "2010.00",
    currency: "BDT",
    baseCurrency: "BDT",
    items: [{
      productId: "db-product-1", product: { productCode: "CATALOG-123" },
      variantId: "db-variant-blue", productName: "Product name", sku: "BLUE-S",
      quantity: 2, unitPrice: "900.00",
    }],
    payments: [{
      provider: method, status: "SUCCESS", requiresReview: false,
      transactionId: "provider-private-id", validationId: method === "SSLCOMMERZ" ? "verified-private-id" : null,
      providerStatus: method === "AIRWALLEX" ? "SUCCEEDED" : null,
      paidAt: new Date("2026-10-04T06:00:00.000Z"),
      amount: method === "AIRWALLEX" ? "16.48" : "2010.00",
      currency: method === "AIRWALLEX" ? "USD" : "BDT",
      baseAmount: method === "AIRWALLEX" ? "2010.00" : null,
      baseCurrency: method === "AIRWALLEX" ? "BDT" : null,
      exchangeRate: method === "AIRWALLEX" ? "0.0082" : null,
    }],
  };
}

describe("server-authoritative online purchase snapshots", () => {
  it("uses the immutable SSL order/payment values and known catalog code", () => {
    const snapshot = buildVerifiedPurchaseSnapshot(paidOrder());
    expect(snapshot).toEqual({
      eventId: "purchase:order-verified", currency: "BDT", value: 2010,
      eventTime: Math.floor(new Date("2026-10-04T06:00:00.000Z").getTime() / 1000),
      items: [{
        productId: "db-product-1", productCode: "CATALOG-123", variantId: "db-variant-blue",
        name: "Product name", sku: "BLUE-S", quantity: 2, unitPrice: 900,
      }],
    });
    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toContain("provider-private-id");
    expect(serialized).not.toContain("verified-private-id");
    expect(serialized).not.toContain("owner-1");
  });

  it("uses Airwallex payment currency/rate rather than storefront display currency", () => {
    const order = paidOrder("AIRWALLEX");
    // Stored payment totals are in major units; conversion is direct BDT -> USD.
    order.payments[0].amount = "16.48";
    expect(buildVerifiedPurchaseSnapshot(order)).toMatchObject({
      currency: "USD", value: 16.48,
      items: [{ productCode: "CATALOG-123", quantity: 2, unitPrice: 7.38 }],
    });
  });

  it("keeps one stable order event identity across refreshes and verification retries", () => {
    const order = paidOrder();
    const first = buildVerifiedPurchaseSnapshot(order);
    const refreshed = buildVerifiedPurchaseSnapshot({ ...order });
    expect(refreshed).toEqual(first);
    expect(buildVerifiedPurchaseSnapshot({ ...order, id: "later-order" })?.eventId)
      .toBe("purchase:later-order");
  });

  it.each(["CASH_ON_DELIVERY", "ONLINE", "PAYPAL"])(
    "does not redefine %s confirmation or manual payment policy", (paymentMethod) => {
      expect(buildVerifiedPurchaseSnapshot(paidOrder(paymentMethod))).toBeNull();
    },
  );

  it.each(["PENDING", "CANCELLED", "RETURNED", "REFUNDED", "RETURN_REQUESTED"])(
    "does not emit from order state %s", (status) => {
      expect(buildVerifiedPurchaseSnapshot({ ...paidOrder(), status })).toBeNull();
    },
  );

  it.each(["PENDING", "UNPAID", "FAILED", "REFUNDED"])(
    "does not emit from payment state %s", (paymentStatus) => {
      expect(buildVerifiedPurchaseSnapshot({ ...paidOrder(), paymentStatus })).toBeNull();
    },
  );

  it("uses the same verified payment evidence for guest and authenticated orders", () => {
    const order = paidOrder();
    expect(buildVerifiedPurchaseSnapshot({ ...order, userId: null })).toEqual(buildVerifiedPurchaseSnapshot(order));
    expect(buildVerifiedPurchaseSnapshot({ ...order, payments: [] })).toBeNull();
    for (const field of ["transactionId", "validationId", "paidAt"] as const) {
      const next = paidOrder();
      next.payments[0][field] = null;
      expect(buildVerifiedPurchaseSnapshot(next)).toBeNull();
    }
    const aw = paidOrder("AIRWALLEX");
    aw.payments[0].providerStatus = "PENDING";
    expect(buildVerifiedPurchaseSnapshot(aw)).toBeNull();
  });

  it("suppresses unresolved review and duplicate successful payment records", () => {
    const review = paidOrder();
    review.payments[0].requiresReview = true;
    expect(buildVerifiedPurchaseSnapshot(review)).toBeNull();
    const duplicate = paidOrder();
    duplicate.payments = [...duplicate.payments, { ...duplicate.payments[0] }];
    expect(buildVerifiedPurchaseSnapshot(duplicate)).toBeNull();
    const otherProvider = paidOrder();
    otherProvider.payments = [...otherProvider.payments, { ...otherProvider.payments[0], provider: "AIRWALLEX" }];
    expect(buildVerifiedPurchaseSnapshot(otherProvider)).toBeNull();
  });

  it("retains paid revenue when optional catalog mapping, quantities or prices are invalid", () => {
    const mutations: ((order: PurchaseOrder) => void)[] = [
      (order) => { order.items[0].product = null; },
      (order) => { order.items[0].product!.productCode = ""; },
      (order) => { order.items[0].productId = null; },
      (order) => { order.items[0].quantity = 0; },
      (order) => { order.items[0].quantity = 1.5; },
      (order) => { order.items[0].unitPrice = "NaN"; },
      (order) => { order.items[0].unitPrice = undefined; },
      (order) => { order.items[0].unitPrice = -1; },
    ];
    for (const mutate of mutations) {
      const order = paidOrder();
      mutate(order);
      expect(buildVerifiedPurchaseSnapshot(order)).toMatchObject({ value: 2010, currency: "BDT", items: [] });
    }
  });

  it("rejects mismatched currency and totals", () => {
    const mutations: ((order: PurchaseOrder) => void)[] = [
      (order) => { order.payments[0].currency = "XXX"; },
      (order) => { order.payments[0].amount = "0"; },
      (order) => { order.payments[0].amount = "201000"; },
    ];
    for (const mutate of mutations) {
      const order = paidOrder();
      mutate(order);
      expect(buildVerifiedPurchaseSnapshot(order)).toBeNull();
    }
  });

  it.each([1500, 1500.75, "1500.75", new Decimal("1500.75")])(
    "serializes actual major-unit database money %s", (total) => {
      const order = paidOrder();
      order.totalAmount = total;
      order.payments[0].amount = total;
      expect(buildVerifiedPurchaseSnapshot(order)).toMatchObject({ value: Number(total), currency: "BDT" });
    },
  );

  it("uses the saved adjusted total rather than merchandise sum or today's cart", () => {
    const order = paidOrder();
    // 1800 merchandise - 100 promo + 80 delivery + 230 tax = 2010.
    const snapshot = buildVerifiedPurchaseSnapshot(order)!;
    order.items = []; // Client cart clearing cannot change a captured payload.
    expect(snapshot.value).toBe(2010);
    expect(snapshot.items).toHaveLength(1);
    expect(buildVerifiedPurchaseSnapshot(order)).toMatchObject({ value: 2010, items: [] });
  });

  it.each([null, undefined, "", " ", "৳1,500", "1,500 BDT", "1500oops", "0x10", "1e3", "NaN", "Infinity", NaN, Infinity, -1, "-1", "1500.001"])(
    "rejects missing or malformed required saved amounts %s without coercing them", (amount) => {
      const order = paidOrder();
      order.totalAmount = amount;
      expect(buildVerifiedPurchaseSnapshot(order)).toBeNull();
      const payment = paidOrder();
      payment.payments[0].amount = amount;
      expect(buildVerifiedPurchaseSnapshot(payment)).toBeNull();
    },
  );

  it("explicitly excludes a legitimate zero-charge order from paid Purchase", () => {
    const order = paidOrder();
    order.totalAmount = new Decimal(0);
    order.payments[0].amount = new Decimal(0);
    vi.stubEnv("META_PURCHASE_DIAGNOSTICS", "true");
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    expect(buildVerifiedPurchaseSnapshot(order)).toBeNull();
    expect(log).toHaveBeenCalledWith("[analytics.meta.purchase]", expect.objectContaining({
      reason: "zero_value_policy", validation: "ineligible", source: "server",
    }));
    vi.unstubAllEnvs();
  });

  it.each(["currency", "baseCurrency"] as const)("never silently relabels order %s", (field) => {
    const order = paidOrder();
    order[field] = "USD";
    expect(buildVerifiedPurchaseSnapshot(order)).toBeNull();
  });

  it("captures original conversion time across callback and delivery retries", () => {
    const order = paidOrder();
    expect(buildVerifiedPurchaseSnapshot(order)?.eventTime).toBe(Math.floor(order.payments[0].paidAt!.getTime() / 1000));
    expect(buildVerifiedPurchaseSnapshot(order)).toEqual(buildVerifiedPurchaseSnapshot({ ...order }));
  });

  it.each(["0", "-1", "NaN"])("rejects corrupt Airwallex rate %s", (exchangeRate) => {
    const order = paidOrder("AIRWALLEX");
    order.payments[0].exchangeRate = exchangeRate;
    expect(buildVerifiedPurchaseSnapshot(order)).toBeNull();
  });

  it("rejects an Airwallex payment snapshot that does not match the persisted order total", () => {
    const order = paidOrder("AIRWALLEX");
    order.payments[0].baseAmount = "1000";
    expect(buildVerifiedPurchaseSnapshot(order)).toBeNull();
    const mismatch = paidOrder("AIRWALLEX");
    mismatch.payments[0].amount = "20";
    expect(buildVerifiedPurchaseSnapshot(mismatch)).toBeNull();
  });
});

describe("canonical owner purchase delivery", () => {
  beforeEach(() => {
    purchaseDelivery.hasPurchaseIntent.mockReset().mockReturnValue(true);
    purchaseDelivery.trackPurchase.mockReset();
  });

  function receipt() {
    return {
      id: "order-verified", userId: "owner-1",
      metaPurchase: buildVerifiedPurchaseSnapshot(paidOrder()),
    };
  }

  it("delivers the verified snapshot with its stable order identity", () => {
    const order = receipt();
    trackPendingOrderPurchase(order, "owner-1");
    expect(purchaseDelivery.trackPurchase).toHaveBeenCalledTimes(1);
    expect(purchaseDelivery.trackPurchase).toHaveBeenCalledWith(order.metaPurchase, "purchase:order-verified");
  });

  it("does not convert historical receipt views without a checkout intent", () => {
    purchaseDelivery.hasPurchaseIntent.mockReturnValue(false);
    trackPendingOrderPurchase(receipt(), "owner-1");
    expect(purchaseDelivery.trackPurchase).not.toHaveBeenCalled();
  });

  it("does not convert administrator, anonymous, or unverified receipt views", () => {
    trackPendingOrderPurchase(receipt(), "administrator");
    trackPendingOrderPurchase(receipt(), undefined);
    trackPendingOrderPurchase({ ...receipt(), metaPurchase: null }, "owner-1");
    expect(purchaseDelivery.trackPurchase).not.toHaveBeenCalled();
  });

  it("isolates analytics errors from receipt and payment rendering", () => {
    purchaseDelivery.trackPurchase.mockImplementation(() => { throw new Error("blocked analytics"); });
    expect(() => trackPendingOrderPurchase(receipt(), "owner-1")).not.toThrow();
    purchaseDelivery.hasPurchaseIntent.mockImplementation(() => { throw new Error("storage unavailable"); });
    expect(() => trackPendingOrderPurchase(receipt(), "owner-1")).not.toThrow();
  });
});
