import { afterEach, describe, expect, it, vi } from "vitest";
import { CART_LOCAL_STORAGE_KEY, readLocalCart, writeLocalCart } from "@/features/cart/storage";
import { WISHLIST_LOCAL_STORAGE_KEY, readLocalWishlist } from "@/features/wishlist/storage";
import { SAVED_LOCAL_STORAGE_KEY, readLocalSaved } from "@/features/cart/saved-storage";

afterEach(() => vi.unstubAllGlobals());
describe("USD shopping cache cutover", () => {
  it("does not persist price snapshots until browser pricing readiness is explicit", () => {
    const setItem = vi.fn();
    vi.stubGlobal("window", { localStorage: { getItem: vi.fn(), setItem } });
    writeLocalCart([]);
    expect(setItem).not.toHaveBeenCalled();
  });
  it("quarantines legacy BDT prices without removing browser history", () => {
    const legacy = JSON.stringify([{ id: "old-product", productId: "old-product", name: "Legacy item", unitPrice: 5000, price: 5000, quantity: 1 }]);
    const storage = new Map([
      ["enterfly:cart:v1", legacy], ["enterfly:wishlist:v1", legacy], ["enterfly:saved-for-later:v1", legacy],
      ["enterfly:meta-purchase:pixel:purchase:old-order", "sdk_handoff"],
    ]);
    vi.stubGlobal("window", { __sexToyUsdPricingReady: true, localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) } });
    expect(readLocalCart()).toEqual([]);
    expect(readLocalWishlist()).toEqual([]);
    expect(readLocalSaved()).toEqual([]);
    writeLocalCart([]);
    expect(storage.get(CART_LOCAL_STORAGE_KEY)).toBe("[]");
    expect(storage.has(WISHLIST_LOCAL_STORAGE_KEY)).toBe(false);
    expect(storage.has(SAVED_LOCAL_STORAGE_KEY)).toBe(false);
    expect(storage.get("enterfly:cart:v1")).toBe(legacy);
    expect(storage.get("enterfly:wishlist:v1")).toBe(legacy);
    expect(storage.get("enterfly:saved-for-later:v1")).toBe(legacy);
    expect(storage.get("enterfly:meta-purchase:pixel:purchase:old-order")).toBe("sdk_handoff");
  });
});
