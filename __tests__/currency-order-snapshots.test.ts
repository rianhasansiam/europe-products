import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { Prisma } from "@/app/generated/prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  createOrderCurrencySnapshot,
  createOrderItemCurrencySnapshot,
} from "@/lib/currency/order-currency-snapshot";
import { createPricingContext } from "@/lib/currency/pricing.service";
import {
  adminCheckoutPreviewSchema,
  adminCheckoutSchema,
  checkoutPreviewSchema,
  checkoutSchema,
} from "@/lib/validations/checkout.validation";

// Importing the checkout service must not create a real database connection in
// this pure unit suite. Vitest hoists this mock ahead of the service import.
vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));

import { presentPersistedOrderSummary } from "@/lib/services/checkout.service";

const quoteTimestamp = "2026-08-19T06:00:00.000Z";

const canonicalAmounts = {
  subtotal: "5000",
  discount: "200",
  shipping: "120",
  tax: "234",
  total: "5154",
  advancePayment: "1000",
} as const;

function decimal(value: string | number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

describe("immutable USD order snapshots", () => {
  it("persists all final USD components at parity with no FX conversion", () => {
    const context = createPricingContext();
    expect(createOrderCurrencySnapshot(canonicalAmounts, context)).toEqual({
      baseCurrency: "USD", displayCurrency: "USD", exchangeRate: "1", exchangeRateAt: null,
      displaySubtotal: 5000, displayDiscountAmount: 200, displayDeliveryCharge: 120,
      displayTaxAmount: 234, displayTotalAmount: 5154, displayAdvancePayment: 1000,
    });
    expect(createOrderItemCurrencySnapshot({ unitPrice: "10.005", totalPrice: "20.01" }, context)).toEqual({ displayUnitPrice: 10.01, displayTotalPrice: 20.01 });
  });
});

describe("historical order presentation", () => {
  it("preserves the original BDT base and frozen USD display amounts", () => {
    const summary = presentPersistedOrderSummary({
      currency: "BDT", baseCurrency: "BDT", displayCurrency: "USD",
      subtotal: decimal(5000), deliveryCharge: decimal(120), discountAmount: decimal(200),
      taxAmount: decimal(234), totalAmount: decimal(5154),
      displaySubtotal: decimal(44.44), displayDeliveryCharge: decimal(1.11),
      displayDiscountAmount: decimal(2.22), displayTaxAmount: decimal(3.33), displayTotalAmount: decimal(46.66),
      exchangeRate: decimal("0.0082"), exchangeRateAt: new Date(quoteTimestamp),
    });
    expect(summary).toMatchObject({ currency: "USD", baseCurrency: "BDT", subtotal: 44.44, total: 46.66, baseSubtotal: 5000, baseTotal: 5154, exchangeRate: "0.0082" });
  });
});

const injectedMoney = {
  price: 0.01,
  unitPrice: 0.01,
  lineTotal: 0.01,
  subtotal: 0.01,
  shipping: 0,
  tax: 0,
  total: 0.01,
  currency: "USD",
  displayCurrency: "USD",
  exchangeRate: "999999",
} as const;

const customerDetails = {
  customerName: "Test Customer",
  customerPhone: "+8801700000000",
  customerAddress: "123 Test Street, Dhaka",
} as const;

describe("checkout input authority", () => {
  it("strips client-supplied prices, totals, currency, and rates from preview input", () => {
    const parsed = checkoutPreviewSchema.parse({
      items: [
        {
          productId: "product-1",
          variantId: "variant-1",
          quantity: 2,
          ...injectedMoney,
        },
      ],
      deliveryZone: "OUTSIDE_DHAKA",
      promoCode: " save10 ",
      ...injectedMoney,
    });

    expect(parsed).toEqual({
      items: [
        { productId: "product-1", variantId: "variant-1", quantity: 2 },
      ],
      deliveryZone: "OUTSIDE_DHAKA",
      promoCode: "save10",
    });
  });

  it("strips the same injected money fields from customer order input", () => {
    const parsed = checkoutSchema.parse({
      ...customerDetails,
      items: [
        {
          productId: "product-1",
          quantity: 1,
          ...injectedMoney,
        },
      ],
      paymentMethod: "AIRWALLEX",
      idempotencyKey: "8d2414af-e2cb-4a19-a6d8-16d0168ee775",
      airwallexQuoteToken: "q".repeat(80),
      ...injectedMoney,
    });

    expect(parsed).toEqual({
      ...customerDetails,
      items: [{ productId: "product-1", quantity: 1 }],
      deliveryZone: "INSIDE_DHAKA",
      paymentMethod: "AIRWALLEX",
      idempotencyKey: "8d2414af-e2cb-4a19-a6d8-16d0168ee775",
      airwallexQuoteToken: "q".repeat(80),
      clearCart: true,
    });
  });

  it("strips injected money fields from admin preview and order item input", () => {
    const adminItems = [
      { productId: "product-1", quantity: 3, ...injectedMoney },
    ];

    expect(
      adminCheckoutPreviewSchema.parse({
        items: adminItems,
        ...injectedMoney,
      }),
    ).toEqual({
      items: [{ productId: "product-1", quantity: 3 }],
      deliveryZone: "INSIDE_DHAKA",
    });

    expect(
      adminCheckoutSchema.parse({
        ...customerDetails,
        customerId: "customer-1",
        items: adminItems,
        ...injectedMoney,
      }),
    ).toEqual({
      ...customerDetails,
        customerId: "customer-1",
      items: [{ productId: "product-1", quantity: 3 }],
      deliveryZone: "INSIDE_DHAKA",
      paymentMethod: "AIRWALLEX",
      clearCart: true,
    });
  });
});

describe("order snapshot database migration", () => {
  it("declares the immutable order and line display snapshot columns", async () => {
    const schema = await readFile(resolve("prisma/schema.prisma"), "utf8");

    for (const field of [
      "baseCurrency",
      "displayCurrency",
      "displaySubtotal",
      "displayDeliveryCharge",
      "displayDiscountAmount",
      "displayTaxAmount",
      "displayTotalAmount",
      "displayAdvancePayment",
      "exchangeRate",
      "exchangeRateAt",
      "displayUnitPrice",
      "displayTotalPrice",
    ]) {
      expect(schema).toMatch(new RegExp(`\\b${field}\\b`));
    }
  });

  it("backfills existing orders and lines before making snapshots required", async () => {
    const migration = await readFile(
      resolve(
        "prisma/migrations/20260819001000_order_currency_snapshots/migration.sql",
      ),
      "utf8",
    );

    expect(migration).toContain(`"currency" = 'BDT'`);
    expect(migration).toContain(`"displayCurrency" = 'BDT'`);
    expect(migration).toContain(`"displaySubtotal" = "subtotal"`);
    expect(migration).toContain(`"displayTotalAmount" = "totalAmount"`);
    expect(migration).toContain(`"exchangeRate" = 1`);
    expect(migration).toContain(`"displayUnitPrice" = "unitPrice"`);
    expect(migration).toContain(`"displayTotalPrice" = "totalPrice"`);
    expect(migration).toMatch(
      /UPDATE "Order"[\s\S]*ALTER TABLE "Order"[\s\S]*"displaySubtotal" SET NOT NULL/,
    );
    expect(migration).toMatch(
      /UPDATE "OrderItem"[\s\S]*ALTER TABLE "OrderItem"[\s\S]*"displayUnitPrice" SET NOT NULL/,
    );
  });

  it("keeps legacy order writers compatible during a rolling deployment", async () => {
    const migration = await readFile(
      resolve(
        "prisma/migrations/20260819002000_order_currency_rollout_compatibility/migration.sql",
      ),
      "utf8",
    );

    expect(migration).toContain(
      'CREATE TRIGGER "Order_currency_snapshot_defaults"',
    );
    expect(migration).toContain(
      'CREATE TRIGGER "OrderItem_currency_snapshot_defaults"',
    );
    expect(migration).toMatch(
      /NEW\."displaySubtotal" := COALESCE\([\s\S]*NEW\."subtotal"/,
    );
    expect(migration).toMatch(
      /NEW\."displayTotalAmount" := COALESCE\([\s\S]*NEW\."totalAmount"/,
    );
    expect(migration).toMatch(
      /NEW\."displayUnitPrice" := COALESCE\([\s\S]*NEW\."unitPrice"/,
    );
    expect(migration).toMatch(
      /NEW\."displayTotalPrice" := COALESCE\([\s\S]*NEW\."totalPrice"/,
    );
  });
});
