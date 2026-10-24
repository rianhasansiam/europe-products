import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Opt in with an already migrated disposable local database. The suite never
// reads DATABASE_URL or .env, and refuses remote or non-test database names.
const configuration = vi.hoisted(() => ({
  url: process.env.GUEST_CHECKOUT_TEST_DATABASE_URL,
}));

vi.mock("@/lib/db/prisma", async () => {
  if (!configuration.url) return { prisma: {} };
  const parsed = new URL(configuration.url);
  if (
    !["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname) ||
    parsed.pathname !== "/sextoy_guest_checkout_test"
  ) {
    throw new Error("Guest database tests require an isolated local sextoy_guest_checkout_test database.");
  }
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { PrismaClient } = await import("@/app/generated/prisma/client");
  return { prisma: new PrismaClient({ adapter: new PrismaPg({ connectionString: configuration.url }) }) };
});

// Next's request cache needs a Next runtime; every database operation and the
// actual settings, catalog, pricing, promotion, and checkout services run live.
vi.mock("next/cache", () => ({ unstable_cache: <T>(callback: T) => callback }));

import { prisma } from "@/lib/db/prisma";
import {
  checkoutCustomerOwnsOrder,
  guestOrderToken,
  hashGuestToken,
} from "@/lib/orders/checkout-customer";
import { previewCheckout, reserveOrderForAirwallex } from "@/lib/services/checkout.service";
import { quoteAirwallexPayment } from "@/lib/airwallex/services/airwallex-currency.service";
import { createAirwallexPaymentQuoteToken } from "@/lib/airwallex/security/airwallex-payment-quote-token";
import { DEFAULT_CURRENCY_CONTEXT } from "@/lib/currency/config";
import { checkoutPrincipal, type CheckoutCustomer } from "@/lib/orders/checkout-customer";

const testQuoteTokens = new Map<string, string>();
async function placeOrder(customer: CheckoutCustomer, data: CheckoutInput) {
  const tokenKey = checkoutPrincipal(customer) + data.idempotencyKey;
  let airwallexQuoteToken = testQuoteTokens.get(tokenKey);
  if (!airwallexQuoteToken) {
  const preview = await previewCheckout(typeof customer === "string" ? customer : null, data);
  const quote = await quoteAirwallexPayment({ baseAmount: preview.summary.baseTotal, displayContext: DEFAULT_CURRENCY_CONTEXT });
  airwallexQuoteToken = createAirwallexPaymentQuoteToken({ userId: checkoutPrincipal(customer), quote });
  testQuoteTokens.set(tokenKey, airwallexQuoteToken);
  }
  return reserveOrderForAirwallex(customer, { ...data, airwallexQuoteToken }, { id: randomUUID(), provider: "AIRWALLEX", idempotencyKey: data.idempotencyKey! });
}
import { getOrderForGuest, getOrderForUser, updateOrderStatus } from "@/lib/services/order.service";
import { checkoutSchema, type CheckoutInput } from "@/lib/validations/checkout.validation";

const USER_ID = "migration-user";
const ADMIN_ID = "migration-admin";
const LEGACY_ORDER_ID = "migration-order";
const PRODUCT_ID = "guest-database-product";
const VARIANT_ID = "guest-database-variant";
const CATEGORY_ID = "guest-database-category";
const guest = { guestKey: `guest:${hashGuestToken("guest-database-browser")}` };
const otherGuest = { guestKey: `guest:${hashGuestToken("another-guest-database-browser")}` };

function input(overrides: Partial<CheckoutInput> & Record<string, unknown> = {}): CheckoutInput {
  return checkoutSchema.parse({
    items: [{ productId: PRODUCT_ID, variantId: VARIANT_ID, quantity: 2 }],
    customerName: "  Guest Customer  ",
    customerPhone: " +880 1700-000000 ",
    customerEmail: " Existing@Example.COM ",
    customerAddress: "  Checkout shipping address  ",
    customerCity: " Dhaka ",
    customerPostalCode: " 1216 ",
    customerNote: " Call before delivery ",
    paymentMethod: "AIRWALLEX",
    airwallexQuoteToken: "x".repeat(80),
    idempotencyKey: randomUUID(),
    ...overrides,
  });
}

describe.skipIf(!configuration.url)("guest checkout on real PostgreSQL", () => {
  beforeAll(async () => {
    vi.stubEnv("AUTH_SECRET", "guest-checkout-database-test-secret-32-characters");
    // These legacy fixtures may have been inserted before applying the guest
    // migration, allowing the same suite to check the upgraded database.
    await prisma.user.upsert({
      where: { id: USER_ID }, update: {},
      create: { id: USER_ID, name: "Existing Customer", email: "existing@example.com", phone: "+8801700000000", password: "original-password-hash" },
    });
    await prisma.user.upsert({
      where: { id: ADMIN_ID }, update: {},
      create: { id: ADMIN_ID, name: "Existing Admin", email: "admin@example.com", role: "ADMIN", password: "admin-password-hash" },
    });
    await prisma.order.upsert({
      where: { id: LEGACY_ORDER_ID }, update: {},
      create: {
        id: LEGACY_ORDER_ID, orderNumber: "EXISTING-ORDER", userId: USER_ID,
        currency: "BDT", baseCurrency: "BDT", displayCurrency: "BDT", paymentMethod: "CASH_ON_DELIVERY",
        subtotal: 1000, totalAmount: 1120, displaySubtotal: 1000, displayTotalAmount: 1120,
        customerName: "Historical Contact", customerPhone: "+8801700000000",
        customerAddress: "Historical shipping address", customerEmail: "existing@example.com",
      },
    });
    await prisma.category.upsert({
      where: { id: CATEGORY_ID }, update: { status: "ACTIVE" },
      create: { id: CATEGORY_ID, name: "Database test category", slug: "database-test", path: "database-test" },
    });
    await prisma.product.upsert({
      where: { id: PRODUCT_ID }, update: {},
      create: { id: PRODUCT_ID, productCode: "GUEST-DATABASE", name: "Database product", slug: "guest-database-product", categoryId: CATEGORY_ID, buyingPrice: 60, salePrice: 100, discountPrice: 90 },
    });
    await prisma.productVariant.upsert({
      where: { id: VARIANT_ID }, update: {},
      create: { id: VARIANT_ID, productId: PRODUCT_ID, stock: 10 },
    });
    await prisma.storeSettings.deleteMany();
    await prisma.storeSettings.create({ data: { currency: "USD", pricingCurrencyVerified: true, taxRate: 0.05, standardShippingFee: 120, expressShippingFee: 250, freeShippingThreshold: 50000 } });
    // Force a real database failure after stock/log/profile writes so rollback
    // coverage cannot pass by merely rejecting validation before transaction.
    await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION reject_guest_order_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."customerNote" = '__force_guest_order_failure__' THEN RAISE EXCEPTION 'forced test order insert failure'; END IF; RETURN NEW; END; $$`);
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS reject_guest_order_test_trigger ON "Order"`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER reject_guest_order_test_trigger BEFORE INSERT ON "Order" FOR EACH ROW EXECUTE FUNCTION reject_guest_order_test()`);
  });

  beforeEach(async () => {
    testQuoteTokens.clear();
    await prisma.promoCodeUsage.deleteMany();
    await prisma.order.deleteMany({ where: { id: { not: LEGACY_ORDER_ID } } });
    await prisma.guestCustomer.deleteMany();
    await prisma.inventoryLog.deleteMany({ where: { variantId: VARIANT_ID } });
    await prisma.promoCode.deleteMany();
    await prisma.product.update({ where: { id: PRODUCT_ID }, data: { status: "ACTIVE", salePrice: 100, discountPrice: 90 } });
    await prisma.productVariant.update({ where: { id: VARIANT_ID }, data: { stock: 10, isActive: true } });
    await prisma.cartItem.deleteMany();
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS reject_guest_order_test_trigger ON "Order"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS reject_guest_order_test()`);
    await prisma.$disconnect();
  });

  it("saves a normalized non-login guest, prices from the catalog, and leaves matching accounts and historical orders unchanged", async () => {
    const beforeUser = await prisma.user.findUniqueOrThrow({ where: { id: USER_ID } });
    const beforeAdmin = await prisma.user.findUniqueOrThrow({ where: { id: ADMIN_ID } });
    const beforeOrder = await prisma.order.findUniqueOrThrow({ where: { id: LEGACY_ORDER_ID } });
    const result = await placeOrder(guest, input({ userId: ADMIN_ID, guestCustomerId: "forged", role: "ADMIN", totalAmount: 0.01 }));
    const profile = await prisma.guestCustomer.findUniqueOrThrow({ where: { id: result.order.guestCustomerId! } });

    expect(result.order.userId).toBeNull();
    expect(profile).toMatchObject({ fullName: "Guest Customer", phone: "+8801700000000", email: "existing@example.com", address: "Checkout shipping address", city: "Dhaka", postalCode: "1216" });
    expect(profile).not.toHaveProperty("password");
    expect(result.order.items[0].unitPrice.toString()).toBe("90");
    expect(result.order.totalAmount.toString()).toBe("309");
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: VARIANT_ID } })).stock).toBe(8);
    expect(await prisma.user.findUniqueOrThrow({ where: { id: USER_ID } })).toEqual(beforeUser);
    expect(await prisma.user.findUniqueOrThrow({ where: { id: ADMIN_ID } })).toEqual(beforeAdmin);
    expect(await prisma.order.findUniqueOrThrow({ where: { id: LEGACY_ORDER_ID } })).toEqual(beforeOrder);
    await prisma.guestCustomer.update({ where: { id: profile.id }, data: { fullName: "Changed profile", address: "New address" } });
    expect(await prisma.order.findUniqueOrThrow({ where: { id: result.order.id } })).toMatchObject({ customerName: "Guest Customer", customerAddress: "Checkout shipping address" });
  });

  it("keeps registered checkout account-bound, ignores submitted email, and clears its persisted cart", async () => {
    await prisma.cartItem.create({ data: { userId: USER_ID, variantId: VARIANT_ID, quantity: 1 } });
    const request = input({ items: undefined, customerEmail: "untrusted@example.com" });
    const result = await placeOrder(USER_ID, request);

    expect(result.order).toMatchObject({ userId: USER_ID, guestCustomerId: null, guestAccessTokenHash: null, customerEmail: "existing@example.com" });
    expect(result.order.items[0].quantity).toBe(1);
    expect(await prisma.guestCustomer.count()).toBe(0);
    expect(await prisma.cartItem.count({ where: { userId: USER_ID } })).toBe(0);
    expect((await placeOrder(USER_ID, request)).order.id).toBe(result.order.id);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: VARIANT_ID } })).stock).toBe(9);
  });

  it("serializes simultaneous identical retries into one order, one guest, one stock debit, and one promo usage", async () => {
    await prisma.promoCode.create({ data: { code: "DATABASE10", discountType: "FLAT", value: 10, usageLimit: 2 } });
    const request = input({ promoCode: "DATABASE10" });
    const [first, second] = await Promise.all([placeOrder(guest, request), placeOrder(guest, request)]);

    expect(second.order.id).toBe(first.order.id);
    expect(await prisma.order.count({ where: { guestCustomerId: { not: null } } })).toBe(1);
    expect(await prisma.guestCustomer.count()).toBe(1);
    expect(await prisma.inventoryLog.count({ where: { variantId: VARIANT_ID } })).toBe(1);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: VARIANT_ID } })).stock).toBe(8);
    expect(await prisma.promoCodeUsage.count()).toBe(1);
    expect((await prisma.promoCode.findUniqueOrThrow({ where: { code: "DATABASE10" } })).usedCount).toBe(1);
  });

  it("rejects changed inputs reusing the same request ID without another stock debit", async () => {
    const request = input();
    await placeOrder(guest, request);
    await expect(placeOrder(guest, { ...request, customerAddress: "Different shipping address" })).rejects.toMatchObject({ status: 409 });
    expect(await prisma.guestCustomer.count()).toBe(1);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: VARIANT_ID } })).stock).toBe(8);
  });

  it("uses existing admin cancellation to restore guest stock and release promotion usage exactly once", async () => {
    await prisma.promoCode.create({ data: { code: "DATABASE10", discountType: "FLAT", value: 10, usageLimit: 2 } });
    const result = await placeOrder(guest, input({ promoCode: "DATABASE10" }));
    // A new reservation that never crossed the HTTP boundary is safe to cancel.
    expect(await prisma.paymentTransaction.findFirst({ where: { orderId: result.order.id } })).toMatchObject({ status: "CREATED", providerStatus: "LOCAL_RESERVED", transactionId: null });
    const cancelled = await updateOrderStatus(result.order.id, { status: "CANCELLED", note: "Admin cancellation" }, ADMIN_ID);

    expect(cancelled).toMatchObject({ status: "CANCELLED", userId: null, guestCustomerId: result.order.guestCustomerId });
    expect(await prisma.paymentTransaction.findFirst({ where: { orderId: result.order.id } })).toMatchObject({ status: "CANCELLED", providerStatus: "LOCAL_CANCELLED", transactionId: null });
    expect(await prisma.paymentTransactionEvent.count({ where: { paymentTransaction: { orderId: result.order.id }, eventName: "airwallex.reservation.cancelled" } })).toBe(1);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: VARIANT_ID } })).stock).toBe(10);
    expect(await prisma.promoCodeUsage.count()).toBe(0);
    expect((await prisma.promoCode.findUniqueOrThrow({ where: { code: "DATABASE10" } })).usedCount).toBe(0);
    expect(await prisma.orderStatusHistory.findFirst({ where: { orderId: result.order.id, status: "CANCELLED" } })).toMatchObject({ updatedBy: ADMIN_ID, note: "Admin cancellation" });
    await expect(updateOrderStatus(result.order.id, { status: "CANCELLED" }, ADMIN_ID)).rejects.toMatchObject({ status: 409 });
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: VARIANT_ID } })).stock).toBe(10);
    expect(await prisma.inventoryLog.count({ where: { variantId: VARIANT_ID, type: "ORDER_CANCELLED" } })).toBe(1);
  });

  it("does not link matching guest contacts or grant access to earlier guest or registered orders", async () => {
    const first = await placeOrder(guest, input());
    const second = await placeOrder(otherGuest, input());

    expect(second.order.guestCustomerId).not.toBe(first.order.guestCustomerId);
    expect(checkoutCustomerOwnsOrder(otherGuest, first.order)).toBe(false);
    expect(await getOrderForGuest(first.order.id, hashGuestToken(guestOrderToken(otherGuest.guestKey, first.order.id)))).toBeNull();
    expect(await getOrderForUser(first.order.id, USER_ID)).toBeNull();
    expect(await getOrderForGuest(LEGACY_ORDER_ID, hashGuestToken(guestOrderToken(guest.guestKey, LEGACY_ORDER_ID)))).toBeNull();
    const allowed = await getOrderForGuest(first.order.id, hashGuestToken(guestOrderToken(guest.guestKey, first.order.id)));
    expect(allowed?.id).toBe(first.order.id);
    expect(allowed).not.toHaveProperty("guestAccessTokenHash");
    expect(allowed).not.toHaveProperty("checkoutKey");
    expect(allowed).not.toHaveProperty("checkoutFingerprint");
  });

  it("rejects unavailable stock without persisting a guest, order, or inventory log", async () => {
    await prisma.productVariant.update({ where: { id: VARIANT_ID }, data: { stock: 1 } });
    await expect(placeOrder(guest, input())).rejects.toMatchObject({ status: 409 });
    expect(await prisma.guestCustomer.count()).toBe(0);
    expect(await prisma.order.count()).toBe(1);
    expect(await prisma.inventoryLog.count({ where: { variantId: VARIANT_ID } })).toBe(0);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: VARIANT_ID } })).stock).toBe(1);
  });

  it("allows only one competing guest to buy the last unit and leaves no failed-attempt profile", async () => {
    await prisma.productVariant.update({ where: { id: VARIANT_ID }, data: { stock: 1 } });
    const request = input({ items: [{ productId: PRODUCT_ID, variantId: VARIANT_ID, quantity: 1 }] });
    const outcomes = await Promise.allSettled([
      placeOrder(guest, request),
      placeOrder(otherGuest, { ...request, idempotencyKey: randomUUID() }),
    ]);

    expect(outcomes.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = outcomes.find((result) => result.status === "rejected");
    expect(rejected?.status === "rejected" ? rejected.reason : null).toMatchObject({ status: 409 });
    expect(await prisma.guestCustomer.count()).toBe(1);
    expect(await prisma.order.count()).toBe(2);
    expect(await prisma.inventoryLog.count({ where: { variantId: VARIANT_ID } })).toBe(1);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: VARIANT_ID } })).stock).toBe(0);
  });

  it("rolls back a failure after stock and guest writes with no orphan profile or inventory change", async () => {
    await expect(placeOrder(guest, input({ customerNote: "__force_guest_order_failure__" }))).rejects.toThrow("forced test order insert failure");
    expect(await prisma.guestCustomer.count()).toBe(0);
    expect(await prisma.order.count()).toBe(1);
    expect(await prisma.inventoryLog.count({ where: { variantId: VARIANT_ID } })).toBe(0);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: VARIANT_ID } })).stock).toBe(10);
  });

  it("enforces mutually exclusive guest/account identities and forbids guest bearer credentials on account orders", async () => {
    const registered = await placeOrder(USER_ID, input());
    const guestOrder = await placeOrder(guest, input());
    await expect(prisma.order.update({ where: { id: registered.order.id }, data: { guestCustomerId: guestOrder.order.guestCustomerId } })).rejects.toThrow();
    await expect(prisma.order.update({ where: { id: registered.order.id }, data: { guestAccessTokenHash: guestOrder.order.guestAccessTokenHash } })).rejects.toThrow();
    expect((await prisma.order.findUniqueOrThrow({ where: { id: registered.order.id } })).guestCustomerId).toBeNull();
  });
});
