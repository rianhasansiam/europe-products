import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OrderDetail } from "@/features/orders/api";

const purchaseDelivery = vi.hoisted(() => ({
  hasPurchaseIntent: vi.fn(),
  trackPurchase: vi.fn(),
}));
vi.mock("@/lib/analytics/meta-pixel", () => purchaseDelivery);

import { trackPendingOrderPurchase } from "@/lib/analytics/order-purchase-browser";

type Receipt = Pick<OrderDetail, "id" | "userId" | "metaPurchase">;

function guestReceipt(): Receipt {
  return {
    id: "guest-order-verified",
    userId: null,
    metaPurchase: {
      eventId: "purchase:guest-order-verified",
      eventTime: 1791093600,
      value: 1500,
      currency: "BDT",
      items: [{ productId: "product-1", productCode: "CATALOG-1", quantity: 1, unitPrice: 1400 }],
    },
  };
}

describe("cookie-authorized guest receipt Purchase", () => {
  beforeEach(() => {
    purchaseDelivery.hasPurchaseIntent.mockReset().mockReturnValue(true);
    purchaseDelivery.trackPurchase.mockReset();
  });

  it("uses the verified order payload after guest checkout without an account", () => {
    const receipt = guestReceipt();
    trackPendingOrderPurchase(receipt, undefined);
    expect(purchaseDelivery.hasPurchaseIntent).toHaveBeenCalledWith(receipt.id);
    expect(purchaseDelivery.trackPurchase).toHaveBeenCalledWith(
      receipt.metaPurchase,
      "purchase:guest-order-verified",
    );
  });

  it("allows the guest's scoped receipt when a session is also present", () => {
    trackPendingOrderPurchase(guestReceipt(), "signed-in-later");
    expect(purchaseDelivery.trackPurchase).toHaveBeenCalledTimes(1);
  });

  it("does not turn a guest receipt revisit into a purchase without checkout intent", () => {
    purchaseDelivery.hasPurchaseIntent.mockReturnValue(false);
    trackPendingOrderPurchase(guestReceipt(), undefined);
    expect(purchaseDelivery.trackPurchase).not.toHaveBeenCalled();
  });

  it("does not emit from a pending or failed guest payment without a verified payload", () => {
    trackPendingOrderPurchase({ ...guestReceipt(), metaPurchase: null }, undefined);
    expect(purchaseDelivery.trackPurchase).not.toHaveBeenCalled();
  });

  it("rejects a payload belonging to another order even with local checkout intent", () => {
    const receipt = guestReceipt();
    receipt.metaPurchase!.eventId = "purchase:another-order";
    trackPendingOrderPurchase(receipt, undefined);
    expect(purchaseDelivery.trackPurchase).not.toHaveBeenCalled();
  });

  it.each([undefined, "administrator", "another-customer"])(
    "preserves registered-order owner checks for viewer %s",
    (viewerId) => {
      trackPendingOrderPurchase({ ...guestReceipt(), userId: "order-owner" }, viewerId);
      expect(purchaseDelivery.trackPurchase).not.toHaveBeenCalled();
    },
  );

  it("preserves registered checkout with the same verified payload rules", () => {
    const receipt = { ...guestReceipt(), userId: "order-owner" };
    trackPendingOrderPurchase(receipt, "order-owner");
    expect(purchaseDelivery.trackPurchase).toHaveBeenCalledWith(
      receipt.metaPurchase,
      "purchase:guest-order-verified",
    );
  });

  it("keeps guest receipt rendering successful when analytics throws", () => {
    purchaseDelivery.trackPurchase.mockImplementation(() => {
      throw new Error("tracking unavailable");
    });
    expect(() => trackPendingOrderPurchase(guestReceipt(), undefined)).not.toThrow();
  });
});
