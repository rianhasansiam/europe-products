import { describe, expect, it, vi } from "vitest";

import { SUPPORTED_CURRENCIES } from "@/lib/currency/config";
import {
  buildPurchaseEventParameters,
  validatePurchaseSnapshot,
  type PurchaseSnapshot,
} from "@/lib/analytics/purchase-payload";

function savedPurchase(): PurchaseSnapshot {
  return {
    eventId: "purchase:order-verified_1",
    eventTime: 1791093600,
    value: 1500.5,
    currency: "BDT",
    items: [{
      productId: "database-product-1",
      productCode: "CATALOG-1",
      variantId: "variant-blue",
      name: "Saved product",
      quantity: 2,
      unitPrice: 600,
    }],
  };
}

describe("final Purchase value validation", () => {
  it.each([null, undefined, "1500", 1500, false])(
    "rejects a non-object snapshot %s", (snapshot) => {
      expect(validatePurchaseSnapshot(snapshot)).toEqual({ valid: false, reason: "invalid_snapshot" });
      expect(buildPurchaseEventParameters(snapshot)).toBeNull();
    },
  );

  it("rejects a missing saved total instead of calculating an item sum", () => {
    const snapshot: Partial<PurchaseSnapshot> = savedPurchase();
    delete snapshot.value;
    expect(validatePurchaseSnapshot(snapshot)).toEqual({ valid: false, reason: "invalid_value" });
    expect(buildPurchaseEventParameters(snapshot)).toBeNull();
  });

  it.each([
    null, undefined, "", " ", "৳1,500", "1,500 BDT", "1500", "1500.50",
    true, false, NaN, Infinity, -Infinity, -1, -0.01, 0.001, 1500.555,
    Number.MAX_SAFE_INTEGER,
  ])("rejects a malformed, nonnumeric, negative, or subminor value %s", (value) => {
    const snapshot = { ...savedPurchase(), value };
    expect(validatePurchaseSnapshot(snapshot)).toEqual({ valid: false, reason: "invalid_value" });
    expect(buildPurchaseEventParameters(snapshot)).toBeNull();
  });

  it.each([0, -0])("identifies explicit zero separately from a missing total", (value) => {
    const snapshot = { ...savedPurchase(), value };
    expect(validatePurchaseSnapshot(snapshot)).toEqual({ valid: false, reason: "zero_value_policy" });
    expect(buildPurchaseEventParameters(snapshot)).toBeNull();
  });

  it.each([1, 1500, 0.01, 16.48, 1500.5, 1500.99])(
    "preserves valid numeric major units %s", (value) => {
      const snapshot = { ...savedPurchase(), value };
      expect(validatePurchaseSnapshot(snapshot)).toEqual({ valid: true, payload: snapshot });
      expect(buildPurchaseEventParameters(snapshot)).toMatchObject({ value, currency: "BDT" });
    },
  );

  it.each(SUPPORTED_CURRENCIES)("accepts configured currency %s", (currency) => {
    const snapshot = { ...savedPurchase(), currency };
    expect(validatePurchaseSnapshot(snapshot)).toEqual({ valid: true, payload: snapshot });
    expect(buildPurchaseEventParameters(snapshot)).toMatchObject({ value: 1500.5, currency });
  });

  it.each([undefined, null, "", "bdt", " BDT ", "JPY", "XYZ", "BDTT", 123])(
    "rejects currency outside the supported configuration %s", (currency) => {
      const snapshot = { ...savedPurchase(), currency };
      expect(validatePurchaseSnapshot(snapshot)).toEqual({ valid: false, reason: "unsupported_currency" });
      expect(buildPurchaseEventParameters(snapshot)).toBeNull();
    },
  );

  it.each([
    undefined, null, "", "order-verified_1", "purchase:", "purchase:order/1",
    "purchase:customer@example.com", `purchase:${"a".repeat(129)}`,
  ])("rejects an invalid stable order event ID %s", (eventId) => {
    expect(validatePurchaseSnapshot({ ...savedPurchase(), eventId }))
      .toEqual({ valid: false, reason: "invalid_event_id" });
  });

  it.each([undefined, null, "1791093600", 0, -1, 1791093600.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    "rejects a missing or invalid original conversion timestamp %s", (eventTime) => {
      expect(validatePurchaseSnapshot({ ...savedPurchase(), eventTime }))
        .toEqual({ valid: false, reason: "invalid_event_time" });
    },
  );

  it("preserves the original stable event ID and payment timestamp across delivery retries", () => {
    const snapshot = savedPurchase();
    const first = validatePurchaseSnapshot(snapshot);
    expect(first).toEqual({ valid: true, payload: snapshot });
    expect(validatePurchaseSnapshot(JSON.parse(JSON.stringify(snapshot)))).toEqual(first);
  });

  it("rejects millisecond timestamps and timestamps beyond the allowed clock skew", () => {
    const now = new Date("2026-10-08T06:00:00.123Z").getTime();
    vi.spyOn(Date, "now").mockReturnValue(now);
    for (const eventTime of [now, Math.floor(now / 1000) + 301]) {
      const snapshot = { ...savedPurchase(), eventTime };
      expect(validatePurchaseSnapshot(snapshot)).toEqual({ valid: false, reason: "invalid_event_time" });
      expect(buildPurchaseEventParameters(snapshot)).toBeNull();
    }
  });

  it("accepts the original paidAt in Unix seconds and the allowed clock-skew boundary", () => {
    const now = new Date("2026-10-08T06:00:00.123Z").getTime();
    vi.spyOn(Date, "now").mockReturnValue(now);
    for (const eventTime of [savedPurchase().eventTime, Math.floor(now / 1000) + 300]) {
      const snapshot = { ...savedPurchase(), eventTime };
      expect(validatePurchaseSnapshot(snapshot)).toEqual({ valid: true, payload: snapshot });
      expect(buildPurchaseEventParameters(snapshot)).toMatchObject({ value: 1500.5, currency: "BDT" });
    }
  });
});

describe("optional Purchase catalog metadata", () => {
  it("sends the required price and currency even with no saved catalog metadata", () => {
    const snapshot: Partial<PurchaseSnapshot> = savedPurchase();
    delete snapshot.items;
    expect(validatePurchaseSnapshot(snapshot)).toEqual({ valid: true, payload: { ...snapshot, items: [] } });
    expect(buildPurchaseEventParameters(snapshot)).toEqual({ value: 1500.5, currency: "BDT" });
  });

  it.each([
    undefined, null, [], "deleted catalog link", [null], [{}],
    [{ productId: "", productCode: "", quantity: 1, unitPrice: 600 }],
    [{ productId: "product-1", quantity: 0, unitPrice: 600 }],
    [{ productId: "product-1", quantity: 1, unitPrice: NaN }],
    [{ productId: "product-1", quantity: 1, unitPrice: 600, variantId: 1 }],
  ])("keeps an eligible Purchase's saved total when catalog metadata is invalid: %j", (items) => {
    const snapshot = { ...savedPurchase(), items };
    expect(validatePurchaseSnapshot(snapshot).valid).toBe(true);
    expect(buildPurchaseEventParameters(snapshot)).toEqual({ value: 1500.5, currency: "BDT" });
  });

  it("retains valid catalog IDs, quantity, prices, and variant metadata deterministically", () => {
    const snapshot = savedPurchase();
    const expected = {
      value: 1500.5,
      currency: "BDT",
      content_ids: ["CATALOG-1"],
      content_type: "product",
      contents: [{ id: "CATALOG-1", quantity: 2, item_price: 600 }],
      content_name: "Saved product",
      variant_ids: ["variant-blue"],
      num_items: 2,
    };
    expect(buildPurchaseEventParameters(snapshot)).toEqual(expected);
    expect(buildPurchaseEventParameters(snapshot)).toEqual(expected);
    expect(snapshot).toEqual(savedPurchase());
  });

  it("preserves authoritative revenue when optional metadata throws during construction", () => {
    const snapshot = savedPurchase();
    Object.defineProperty(snapshot.items[0], "productCode", {
      get() { throw new Error("corrupt optional metadata"); },
    });
    expect(() => buildPurchaseEventParameters(snapshot)).not.toThrow();
    expect(buildPurchaseEventParameters(snapshot)).toEqual({ value: 1500.5, currency: "BDT" });
  });

  it.each([{ nested: "malformed product name" }, 123])(
    "omits a non-string optional product name while retaining valid price and catalog metadata: %j",
    (name) => {
      const snapshot = { ...savedPurchase(), items: [{ ...savedPurchase().items[0], name }] };
      expect(buildPurchaseEventParameters(snapshot)).toEqual({
        value: 1500.5,
        currency: "BDT",
        content_ids: ["CATALOG-1"],
        content_type: "product",
        contents: [{ id: "CATALOG-1", quantity: 2, item_price: 600 }],
        variant_ids: ["variant-blue"],
        num_items: 2,
      });
    },
  );

  it("deduplicates content IDs and variant IDs while preserving saved line quantities", () => {
    const snapshot = {
      ...savedPurchase(),
      items: [
        { productId: "product-1", productCode: " CATALOG-1 ", variantId: " blue ", quantity: 2, unitPrice: 600 },
        { productId: "product-1", productCode: "CATALOG-1", variantId: "blue", quantity: 1, unitPrice: 600 },
        { productId: " product-2 ", quantity: 1, unitPrice: 30 },
      ],
    };
    expect(buildPurchaseEventParameters(snapshot)).toEqual({
      value: 1500.5,
      currency: "BDT",
      content_ids: ["CATALOG-1", "product-2"],
      content_type: "product",
      contents: [
        { id: "CATALOG-1", quantity: 2, item_price: 600 },
        { id: "CATALOG-1", quantity: 1, item_price: 600 },
        { id: "product-2", quantity: 1, item_price: 30 },
      ],
      variant_ids: ["blue"],
      num_items: 4,
    });
  });

  it("never replaces the saved total with a changed merchandise sum or cleared cart", () => {
    const snapshot = savedPurchase();
    expect(buildPurchaseEventParameters(snapshot)?.value).toBe(1500.5);
    snapshot.items[0].unitPrice = 9999;
    snapshot.items[0].quantity = 9;
    expect(buildPurchaseEventParameters(snapshot)?.value).toBe(1500.5);
    snapshot.items = [];
    expect(buildPurchaseEventParameters(snapshot)).toEqual({ value: 1500.5, currency: "BDT" });
  });
});
