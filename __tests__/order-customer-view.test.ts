import { Prisma } from "@/app/generated/prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const orderFindUnique = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    order: { findUnique: orderFindUnique },
  },
}));

import {
  getCustomerOrderViewForAdmin,
  serializeCustomerOrder,
} from "@/lib/services/order.service";

function decimal(value: string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function airwallexOrder(paymentCurrency = " eur ") {
  return {
    id: "order-1",
    paymentMethod: "AIRWALLEX",
    subtotal: decimal("1250.00"),
    deliveryCharge: decimal("0"),
    discountAmount: decimal("0"),
    taxAmount: decimal("0"),
    totalAmount: decimal("1250.00"),
    advancePayment: decimal("0"),
    currency: "BDT",
    baseCurrency: "BDT",
    displayCurrency: "EUR",
    displaySubtotal: decimal("10.63"),
    displayDeliveryCharge: decimal("0"),
    displayDiscountAmount: decimal("0"),
    displayTaxAmount: decimal("0"),
    displayTotalAmount: decimal("10.63"),
    displayAdvancePayment: decimal("0"),
    exchangeRate: decimal("0.0085"),
    exchangeRateAt: new Date("2026-08-22T11:58:00.000Z"),
    items: [
      {
        id: "item-1",
        productId: "product-1",
        variantId: null,
        productName: "Test product",
        productImage: null,
        sku: null,
        variantName: null,
        color: null,
        size: null,
        variantAttributes: null,
        quantity: 1,
        unitPrice: decimal("1250.00"),
        totalPrice: decimal("1250.00"),
        displayUnitPrice: decimal("10.63"),
        displayTotalPrice: decimal("10.63"),
        product: null,
      },
    ],
    payments: [
      {
        provider: "AIRWALLEX",
        amount: decimal("10.63"),
        currency: paymentCurrency,
        status: "CREATED",
        requiresReview: false,
      },
    ],
    statusHistory: [],
  } as unknown as Parameters<typeof serializeCustomerOrder>[0];
}

describe("customer-facing admin order reads", () => {
  beforeEach(() => {
    orderFindUnique.mockReset();
  });

  it("returns the same normalized payment snapshot used for an owner", async () => {
    orderFindUnique.mockResolvedValue(airwallexOrder());

    const result = await getCustomerOrderViewForAdmin("order-1");

    expect(orderFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "order-1" } }),
    );
    expect(result).toMatchObject({
      currency: "EUR",
      baseCurrency: "BDT",
      totalAmount: 10.63,
      baseTotalAmount: 1250,
      paymentAmount: 10.63,
      paymentCurrency: "EUR",
    });
  });

  it("does not expose an unsupported stored payment currency", () => {
    const result = serializeCustomerOrder(airwallexOrder("CAD"));

    expect(result).toMatchObject({
      paymentAmount: null,
      paymentCurrency: "EUR",
    });
  });
});
