import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DRAFT_PREFIX, discardOtherIdentityDrafts, discardPreparedDrafts,
  isLanguageFormControlDirty, languageDraftIdentity, languageDraftKey,
  hasUnrecoverableDraftState,
  markLanguageFormDirty, prepareLanguageDrafts, readLanguageDraft,
  resetLanguageFormDirty, writeLanguageDraft,
  restoreLanguageDraftFields,
} from "@/lib/i18n/drafts";

let storage: Map<string, string>;
beforeEach(() => {
  storage = new Map();
  vi.stubGlobal("sessionStorage", {
    get length() { return storage.size; },
    key: (index: number) => [...storage.keys()][index] ?? null,
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  vi.spyOn(Date, "now").mockReturnValue(1_000_000);
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("identity-scoped language recovery", () => {
  it("waits for auth resolution and isolates guest and each user", () => {
    expect(languageDraftIdentity("loading", "user-1")).toBeNull();
    expect(languageDraftIdentity("authenticated", null)).toBeNull();
    expect(languageDraftIdentity("unauthenticated")).toBe("guest");
    const user1 = languageDraftIdentity("authenticated", "user-1")!;
    const user2 = languageDraftIdentity("authenticated", "user-2")!;
    const keys = ["guest", user1, user2].map((identity) => languageDraftKey("checkout", "/checkout", "?promo=SAVE", identity));
    expect(new Set(keys).size).toBe(3);
    writeLanguageDraft(keys[1], { customerAddress: "Private address" }, user1);
    expect(readLanguageDraft(keys[0], "guest")).toBeNull();
    expect(readLanguageDraft(keys[2], user2)).toBeNull();
    expect(readLanguageDraft(keys[1], user1)).toEqual({ customerAddress: "Private address" });
    expect(readLanguageDraft(keys[1], user1)).toBeNull();
  });
  it("requires matching envelope identity and clears prior identities on auth changes", () => {
    writeLanguageDraft("user-draft", { customerEmail: "first@example.test" }, "user:first");
    writeLanguageDraft("guest-draft", { name: "Guest" }, "guest");
    storage.set("cart", "unchanged");
    discardOtherIdentityDrafts("guest");
    expect(storage.has(DRAFT_PREFIX + "user-draft")).toBe(false);
    expect(readLanguageDraft("guest-draft", "guest")).toEqual({ name: "Guest" });
    expect(storage.get("cart")).toBe("unchanged");
    writeLanguageDraft("forged-owner", { customerAddress: "Private" }, "user:first");
    expect(readLanguageDraft("forged-owner", "guest")).toBeNull();
  });
  it("expires after ten minutes and rejects future or malformed timestamps", () => {
    for (const at of [399_999, 1_000_001, "invalid"]) {
      storage.set(DRAFT_PREFIX + "draft", JSON.stringify({ at, identity: "guest", value: { name: "Old" } }));
      expect(readLanguageDraft("draft", "guest")).toBeNull();
      expect(storage.has(DRAFT_PREFIX + "draft")).toBe(false);
    }
  });
  it("never stores sensitive keys, files or nested payment data", () => {
    writeLanguageDraft("safe", {
      name: "Guest", password: "password-secret", cardNumber: "4111111111111111",
      clientSecret: "client-secret", paymentToken: "payment-token",
      nested: { cardNumber: "4111111111111111" }, file: new Blob(["private"]),
      quantity: 2, deselectedIds: ["product-1"], key: "checkout-idempotency-key",
    }, "guest");
    expect(JSON.stringify([...storage.values()])).not.toMatch(/password-secret|4111111111111111|client-secret|payment-token|private/);
    expect(readLanguageDraft("safe", "guest")).toEqual({ name: "Guest", quantity: 2, deselectedIds: ["product-1"], key: "checkout-idempotency-key" });
    expect(() => writeLanguageDraft("large", { note: "x".repeat(70_000) }, "guest")).toThrow("too large");
  });
  it("warns about a password retained by a multi-step form even outside its allowlist", () => {
    expect(hasUnrecoverableDraftState({ name: "Guest", password: "still-in-state" }, ["name"])).toBe(true);
    expect(hasUnrecoverableDraftState({ name: "Guest", password: "", confirmPassword: "" }, ["name"])).toBe(false);
    expect(hasUnrecoverableDraftState({ customerName: "Guest", payment: { clientSecret: "private" } }, ["customerName", "payment"])).toBe(true);
    expect(hasUnrecoverableDraftState({ name: "Guest", image: "https://example.test/avatar.png" }, ["name", "image"])).toBe(false);
  });
  it("discards only drafts prepared by the cancelled or failed switch", () => {
    writeLanguageDraft("discard", { name: "First" }, "guest");
    writeLanguageDraft("keep", { name: "Second" }, "guest");
    discardPreparedDrafts({ failed: false, unrecoverable: false, blocked: false, savedKeys: ["discard"] });
    expect(readLanguageDraft("discard", "guest")).toBeNull();
    expect(readLanguageDraft("keep", "guest")).toEqual({ name: "Second" });
  });
  it("keeps fresh edits while restoring untouched fields and explicit profile overrides", () => {
    expect(restoreLanguageDraftFields(
      { name: "Fresh typing", phone: "" }, { name: "", phone: "" },
      { name: "Recovered", phone: "01700000000" }, ["name", "phone"],
    )).toEqual({ name: "Fresh typing", phone: "01700000000" });
    expect(restoreLanguageDraftFields(
      { name: "Saved profile" }, { name: "Saved profile" },
      { name: "Explicit shipping name" }, ["name"],
    )).toEqual({ name: "Explicit shipping name" });
  });
});

describe("unsaved native form edits", () => {
  it("recognizes select, checkbox and radio changes without persisting them", () => {
    expect(isLanguageFormControlDirty({ tagName: "INPUT", type: "checkbox", checked: true, defaultChecked: false })).toBe(true);
    expect(isLanguageFormControlDirty({ tagName: "INPUT", type: "radio", checked: false, defaultChecked: true })).toBe(true);
    expect(isLanguageFormControlDirty({ tagName: "SELECT", options: [{ selected: false, defaultSelected: true }, { selected: true, defaultSelected: false }] })).toBe(true);
    expect(isLanguageFormControlDirty({ tagName: "SELECT", options: [{ selected: true, defaultSelected: false }, { selected: false, defaultSelected: false }] })).toBe(false);
    expect(isLanguageFormControlDirty({ tagName: "SELECT", multiple: true, options: [{ selected: true, defaultSelected: false }] })).toBe(true);
  });
  it("retains actual edit tracking when React updates a controlled input's default", () => {
    const form = { elements: [{ tagName: "INPUT", type: "text", value: "Changed", defaultValue: "Changed" }] } as unknown as HTMLFormElement;
    vi.stubGlobal("window", { dispatchEvent: vi.fn() });
    vi.stubGlobal("document", { querySelectorAll: (selector: string) => selector === "input" ? [] : [form] });
    vi.stubGlobal("CustomEvent", class { detail: unknown; constructor(_type: string, options: { detail: unknown }) { this.detail = options.detail; } });
    expect(prepareLanguageDrafts().unrecoverable).toBe(false);
    markLanguageFormDirty(form);
    expect(prepareLanguageDrafts().unrecoverable).toBe(true);
    resetLanguageFormDirty(form);
    expect(prepareLanguageDrafts().unrecoverable).toBe(false);
  });
});
