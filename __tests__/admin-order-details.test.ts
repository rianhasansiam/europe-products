import { createElement } from "react";
import { renderToStaticMarkup } from "./helpers/intl";
import { describe, expect, it } from "vitest";

import AdminOrderDetails from "@/app/admin/orders/components/AdminOrderDetails";
import type {
  AdminOrderDetail,
  AdminOrderItem,
} from "@/features/admin-orders/api";

function item(overrides: Partial<AdminOrderItem> = {}): AdminOrderItem {
  return {
    id: "item-1",
    productId: "product-1",
    variantId: "variant-1",
    productName: "Original purchased shirt",
    productImage: "/uploads/original-shirt.jpg",
    sku: "SHIRT-RED-M",
    variantName: "Everyday fit",
    color: "Red",
    size: "M",
    variantAttributes: { Color: "Red", Size: "M" },
    attributeSummary: "Color: Red · Size: M",
    quantity: 3,
    unitPrice: 275,
    totalPrice: 825,
    displayUnitPrice: 2.25,
    displayTotalPrice: 6.75,
    product: { id: "product-1", name: "Renamed live product", slug: "new-name" },
    ...overrides,
  };
}

function order(overrides: Partial<AdminOrderDetail> = {}): AdminOrderDetail {
  return {
    id: "order-1",
    orderNumber: "BB-1001",
    userId: null,
    guestCustomerId: "guest-1",
    subtotal: 825,
    deliveryCharge: 80,
    discountAmount: 50,
    taxAmount: 10,
    totalAmount: 865,
    advancePayment: 125,
    promoCode: "SAVE50",
    status: "PENDING",
    paymentMethod: "CASH_ON_DELIVERY",
    paymentStatus: "UNPAID",
    requiresPaymentReview: false,
    customerName: "Buyer name",
    customerPhone: "01700000000",
    customerEmail: "checkout@example.com",
    customerAddress: "12 Example Road",
    customerCity: "Dhaka",
    customerArea: "Dhanmondi",
    customerPostalCode: "1209",
    customerNote: "Call before delivery",
    createdAt: "2026-10-06T10:00:00.000Z",
    updatedAt: "2026-10-06T11:00:00.000Z",
    user: null,
    items: [item()],
    statusHistory: [
      { id: "history-1", status: "PENDING", note: "Order created", updatedBy: null, createdAt: "2026-10-06T10:00:00.000Z" },
      { id: "history-2", status: "PAYMENT_CONFIRMED", note: "Receipt checked", updatedBy: "admin-1", createdAt: "2026-10-06T11:00:00.000Z" },
    ],
    ...overrides,
  };
}

function render(overrides: Partial<AdminOrderDetail> = {}) {
  return renderToStaticMarkup(createElement(AdminOrderDetails, { order: order(overrides) }));
}

/** Read a semantic amount row without relying on generated classes or locale separators. */
function amount(markup: string, label: string): string | null {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = markup.match(new RegExp(`<dt>${escapedLabel}</dt><dd[^>]*>([^<]*)</dd>`));
  return match?.[1] ?? null;
}

describe("admin order details rendering", () => {
  it("shows purchased snapshots and canonical prices rather than current catalog or display prices", () => {
    const markup = render();

    expect(markup).toContain("Original purchased shirt");
    expect(markup).not.toContain("Renamed live product");
    expect(markup).toContain(encodeURIComponent("/uploads/original-shirt.jpg"));
    expect(markup).toContain("Everyday fit · Color: Red · Size: M");
    expect(markup).toContain("SKU: SHIRT-RED-M");
    expect(markup).toContain("Qty 3 × BDT 275");
    expect(markup).toContain("BDT 825");
    expect(markup).not.toContain("BDT 2.25");
    expect(markup).not.toContain("BDT 6.75");
  });

  it("retains the purchased item after its product and variant have been deleted", () => {
    const markup = render({ items: [item({ productId: null, variantId: null, product: null, productImage: null })] });

    expect(markup).toContain("Original purchased shirt");
    expect(markup).toContain("SKU: SHIRT-RED-M");
    expect(markup).toContain("Qty 3 × BDT 275");
    expect(markup).not.toContain("<img");
  });

  it("falls back to legacy size and color when no attribute summary was captured", () => {
    const markup = render({ items: [item({ variantName: null, variantAttributes: null, attributeSummary: null })] });

    expect(markup).toContain("M · Red");
  });

  it("labels an explicit guest identity and displays the shipping contact", () => {
    const markup = render();

    expect(markup).toContain(">Guest</span>");
    expect(markup).toContain("checkout@example.com");
    expect(markup).toContain("12 Example Road");
    expect(markup).toContain("Dhanmondi, Dhaka, 1209");
    expect(markup).toContain("Call before delivery");
  });

  it("does not infer a guest account for a legacy order without customer relations", () => {
    const markup = render({ guestCustomerId: null, userId: null });

    expect(markup).not.toContain(">Guest</span>");
    expect(markup).not.toContain(">Registered</span>");
    expect(markup).toContain("Buyer name");
  });

  it("distinguishes the registered account email from the checkout contact snapshot", () => {
    const markup = render({ guestCustomerId: null, userId: "user-1", user: { id: "user-1", name: "Account name", email: "account@example.com", phone: null } });

    expect(markup).toContain(">Registered</span>");
    expect(markup).toContain("checkout@example.com");
    expect(markup).toContain("Account email: account@example.com");
    expect(markup).toContain("Buyer name");
  });

  it("shows the full totals breakdown including tax, promotion and advance payment", () => {
    const markup = render();

    expect(amount(markup, "Subtotal")).toBe("BDT 825");
    expect(amount(markup, "Delivery charge")).toBe("BDT 80");
    expect(amount(markup, "Discount (SAVE50)")).toBe("BDT -50");
    expect(amount(markup, "Tax")).toBe("BDT 10");
    expect(amount(markup, "Order total")).toBe("BDT 865");
    expect(amount(markup, "Advance payment")).toBe("BDT 125");
    expect(amount(markup, "Balance due")).toBe("BDT 740");
  });

  it("shows zero balance once paid even when the advance payment is less than the total", () => {
    expect(amount(render({ paymentStatus: "PAID" }), "Balance due")).toBe("BDT 0");
  });

  it.each(["CANCELLED", "RETURN_REQUESTED", "RETURNED", "REFUNDED"] as const)(
    "does not suggest collecting a balance for an unpaid %s order",
    (status) => {
      expect(amount(render({ status }), "Balance due")).toBeNull();
    },
  );

  it("does not suggest collecting a refunded payment regardless of order status", () => {
    expect(amount(render({ paymentStatus: "REFUNDED" }), "Balance due")).toBeNull();
  });

  it("never displays a negative balance when the advance payment exceeds the total", () => {
    expect(amount(render({ advancePayment: 900 }), "Balance due")).toBe("BDT 0");
  });

  it("preserves history order and multiline notes while escaping note markup", () => {
    const markup = render({
      customerNote: "Leave by door\n<script>unsafe()</script>",
      statusHistory: [
        { id: "history-1", status: "PENDING", note: "First audit note\n<script>unsafe()</script>", updatedBy: null, createdAt: "2026-10-06T10:00:00.000Z" },
        { id: "history-2", status: "PAYMENT_CONFIRMED", note: "Second audit note", updatedBy: "admin-1", createdAt: "2026-10-06T11:00:00.000Z" },
        { id: "history-3", status: "SELLER_TO_PACK", note: null, updatedBy: "admin-1", createdAt: "2026-10-06T12:00:00.000Z" },
      ],
    });

    expect(markup).toContain("Leave by door\n&lt;script&gt;unsafe()&lt;/script&gt;");
    expect(markup).toContain("First audit note\n&lt;script&gt;unsafe()&lt;/script&gt;");
    expect(markup).not.toContain("<script>");
    expect(markup.indexOf("First audit note")).toBeLessThan(markup.indexOf("Second audit note"));
    expect(markup).not.toContain(">null<");
  });

  it("shows useful empty states for older orders without items or status history", () => {
    const markup = render({ items: [], statusHistory: [], customerNote: null });

    expect(markup).toContain("No items recorded for this order.");
    expect(markup).toContain("No status history recorded for this order.");
    expect(markup).not.toContain("Order note</h3>");
  });

  it("calls out payments awaiting manual review", () => {
    const markup = render({ requiresPaymentReview: true });

    expect(markup).toContain('role="status"');
    expect(markup).toContain("Manual payment review required");
    expect(markup).toContain("Review this payment before continuing fulfillment.");
  });
});
