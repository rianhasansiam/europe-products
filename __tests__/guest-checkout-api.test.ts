import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CheckoutSubmissionError, placeCheckoutOrder, type PlaceOrderRequest } from "@/features/checkout/api";

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

function previewResponse() {
  return new Response(JSON.stringify({ success: true, data: { items: [], promo: null } }));
}

describe("guest preview browser identity bootstrap", () => {
  it("waits for the initial successful response before sending a concurrent preview", async () => {
    let finish!: (value: Response) => void;
    const fetchMock = vi.fn<typeof fetch>()
      .mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }))
      .mockImplementation(async () => previewResponse());
    vi.stubGlobal("fetch", fetchMock);
    const { fetchCheckoutPreview } = await import("@/features/checkout/api");
    const first = fetchCheckoutPreview({ items: [{ productId: "product-1", quantity: 1 }] });
    const second = fetchCheckoutPreview({ items: [{ productId: "product-2", quantity: 2 }] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    finish(previewResponse());
    await first;
    await second;
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
      items: [{ productId: "product-2", quantity: 2 }],
    });
  });

  it("allows later previews to run in parallel after identity bootstrap succeeds", async () => {
    const finishers: Array<(value: Response) => void> = [];
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(previewResponse())
      .mockImplementation(() => new Promise((resolve) => { finishers.push(resolve); }));
    vi.stubGlobal("fetch", fetchMock);
    const { fetchCheckoutPreview } = await import("@/features/checkout/api");
    await fetchCheckoutPreview({ items: [] });
    const first = fetchCheckoutPreview({ items: [] });
    const second = fetchCheckoutPreview({ items: [] });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(finishers).toHaveLength(2);
    finishers.forEach((finish) => finish(previewResponse()));
    await Promise.all([first, second]);
  });

  it("releases a waiting preview to retry when the initial bootstrap fails", async () => {
    let fail!: (error: Error) => void;
    const fetchMock = vi.fn<typeof fetch>()
      .mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject; }))
      .mockImplementation(async () => previewResponse());
    vi.stubGlobal("fetch", fetchMock);
    const { fetchCheckoutPreview } = await import("@/features/checkout/api");
    const first = fetchCheckoutPreview({ items: [] });
    const rejection = expect(first).rejects.toThrow("Connection interrupted");
    const second = fetchCheckoutPreview({ items: [{ productId: "product-2", quantity: 1 }] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fail(new Error("Connection interrupted"));
    await rejection;
    await expect(second).resolves.toEqual({ items: [], promo: null });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("checkout server field validation", () => {
  it("preserves validation messages for the form without accepting malformed field messages", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: false,
      message: "Please review the highlighted fields and try again.",
      fieldErrors: {
        customerPhone: ["Enter a valid phone number.", "Phone is required."],
        customerEmail: [null, "Enter a valid email address."],
        unknown: [5],
      },
    }), { status: 400 })));
    const body: PlaceOrderRequest = {
      customerName: "Guest Buyer", customerPhone: "01700000000", customerAddress: "12 Main Road",
      deliveryZone: "INSIDE_DHAKA", paymentMethod: "AIRWALLEX",
      idempotencyKey: "8d2414af-e2cb-4a19-a6d8-16d0168ee775",
    };
    try {
      await placeCheckoutOrder(body);
      expect.unreachable("The failed validation response must reject checkout.");
    } catch (error) {
      expect(error).toBeInstanceOf(CheckoutSubmissionError);
      expect((error as CheckoutSubmissionError).fieldErrors).toEqual({
        customerPhone: "Enter a valid phone number.", customerEmail: "Enter a valid email address.",
      });
    }
  });
});
