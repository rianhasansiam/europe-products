import { BASE_CURRENCY, type CurrencyCode } from "@/lib/currency/config";
import { buildEcommercePayload, localCartAddedItems, type CommerceItem, type CommerceSnapshot, type EcommercePayload } from "./ecommerce";
import { buildPurchaseEventParameters, validatePurchaseSnapshot, type PurchaseEventParameters } from "./purchase-payload";
import { logPurchaseDiagnostic } from "./purchase-diagnostics";

type MetaEvent = "PageView" | "ViewContent" | "AddToCart" | "InitiateCheckout";
type PixelCommand = unknown[];
export type PixelFunction = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue?: PixelCommand[];
  push?: PixelFunction;
  loaded?: boolean;
  version?: string;
};
type PixelState = {
  pixelId: string | null;
  initialized: boolean;
  scriptRequested: boolean;
  consent: boolean;
  sent: Set<string>;
  navigation: { route: string; id: string } | null;
  purchaseIntents: Set<string>;
  allowStoredPurchaseIntents: boolean;
  pendingPurchases: Map<string, PurchaseEventParameters>;
  purchaseHandoffs: Set<string>;
};
declare global {
  interface Window {
    fbq?: PixelFunction;
    _fbq?: PixelFunction;
    __bangbuyMetaPixel?: PixelState;
  }
}

function state(): PixelState | null {
  if (typeof window === "undefined") return null;
  const current = window.__bangbuyMetaPixel ??= {
    pixelId: null, initialized: false, scriptRequested: false,
    consent: true, // Preserve existing behavior: no consent control exists in the repo.
    sent: new Set(), navigation: null, purchaseIntents: new Set(), allowStoredPurchaseIntents: true,
    pendingPurchases: new Map(), purchaseHandoffs: new Set(),
  };
  // Development module replacement may retain the document's existing state.
  current.pendingPurchases ??= new Map();
  current.purchaseHandoffs ??= new Set();
  return current;
}

export function createEventId(): string {
  try {
    return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  } catch { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`; }
}

/** Meta's supported bootstrap queue is available before its external script loads. */
export function initializeMetaPixel(pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? ""): boolean {
  try {
    const current = state();
    if (!current || !current.consent) return false;
    const configuredId = pixelId.trim();
    if (!/^\d+$/.test(configuredId)) return false;
    if (current.initialized && current.pixelId !== configuredId) return false;
    current.pixelId = configuredId;
    if (!window.fbq) {
      const queue: PixelCommand[] = [];
      const fbq: PixelFunction = (...args) => {
        if (fbq.callMethod) fbq.callMethod(...args);
        else queue.push(args);
      };
      fbq.queue = queue;
      fbq.push = fbq;
      fbq.loaded = true;
      fbq.version = "2.0";
      window.fbq = fbq;
      window._fbq ??= fbq;
    }
    // Once per document, including remounts and development effect replay.
    if (!current.initialized) {
      window.fbq("init", configuredId);
      current.initialized = true;
    }
    if (!current.scriptRequested && !window.fbq.callMethod) {
      const script = document.createElement("script");
      script.async = true;
      script.src = "https://connect.facebook.net/en_US/fbevents.js";
      script.id = "meta-pixel";
      script.onload = () => {
        try {
          if (window.fbq?.callMethod) flushPendingPurchases(current);
          else {
            current.scriptRequested = false;
            script.remove?.();
            for (const eventId of current.pendingPurchases.keys()) {
              logPurchaseDiagnostic({ eventId, source: "browser", validation: "valid", status: "unavailable" });
            }
          }
        } catch { /* A third-party script must not affect checkout or receipts. */ }
      };
      script.onerror = () => {
        try {
          current.scriptRequested = false;
          script.remove?.();
          for (const eventId of current.pendingPurchases.keys()) {
            logPurchaseDiagnostic({ eventId, source: "browser", validation: "valid", status: "script_failed" });
          }
        } catch { /* Keep pending identities available for a later attempt. */ }
      };
      current.scriptRequested = true;
      try { document.head.appendChild(script); }
      catch {
        current.scriptRequested = false;
        try { script.remove?.(); } catch { /* Removal is optional after a blocked append. */ }
        throw new Error("Meta script unavailable");
      }
    }
    flushPendingPurchases(current);
    return true;
  } catch { return false; }
}

/** Consent integration gate; denied actions are discarded, never replayed. */
export function setMetaPixelConsent(granted: boolean): void {
  try {
    const current = state();
    if (!current) return;
    current.consent = granted;
    if (!granted) {
      for (const eventId of current.pendingPurchases.keys()) {
        current.sent.add(`Purchase:${eventId}`);
        logPurchaseDiagnostic({ eventId, source: "browser", validation: "valid", status: "consent_denied" });
      }
      current.pendingPurchases.clear();
      const prefix = `enterfly:meta-checkout:${current.pixelId ?? process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim()}:`;
      // Pending payment attribution is also analytics activity. Discard it on
      // revocation, including intents from an earlier document in this browser.
      const pendingIds = [...current.purchaseIntents];
      current.purchaseIntents.clear();
      current.allowStoredPurchaseIntents = false;
      try {
        const storage = window.localStorage;
        for (const orderId of pendingIds) storage.removeItem(`${prefix}${orderId}`);
        for (let index = storage.length - 1; index >= 0; index -= 1) {
          const key = storage.key(index);
          if (key?.startsWith(prefix)) storage.removeItem(key);
        }
      } catch { /* Restricted storage still has the cleared in-memory gate. */ }
    }
    if (!granted && window.fbq?.queue) {
      const retained = window.fbq.queue.filter((command) => !["track", "trackCustom", "trackSingle", "trackSingleCustom"].includes(String(command[0])));
      window.fbq.queue.splice(0, window.fbq.queue.length, ...retained);
    }
    if (current.initialized) window.fbq?.("consent", granted ? "grant" : "revoke");
  } catch { /* Analytics must never affect shopping. */ }
}

export function getNavigationEventId(scope: string, route: string): string {
  try {
    const current = state();
    if (!current) return `${scope}:server`;
    if (current.navigation?.route !== route) current.navigation = { route, id: createEventId() };
    return `${scope}:${current.navigation.id}`;
  } catch { return `${scope}:${createEventId()}`; }
}

/** Anchor payment attribution to a committed checkout in this browser, not receipt visits. */
export function registerPurchaseIntent(orderId: string): void {
  try {
    const current = state();
    if (!current?.consent || !orderId || !initializeMetaPixel(current.pixelId ?? undefined)) return;
    current.purchaseIntents.add(orderId);
    try { window.localStorage.setItem(`enterfly:meta-checkout:${current.pixelId}:${orderId}`, "1"); } catch { /* Memory fallback. */ }
  } catch { /* No analytics failure may interrupt payment navigation. */ }
}

export function hasPurchaseIntent(orderId: string): boolean {
  try {
    const current = state();
    if (!current?.consent || !orderId) return false;
    if (current.purchaseIntents.has(orderId)) return true;
    if (!current.allowStoredPurchaseIntents) return false;
    const pixelId = current.pixelId ?? process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim();
    if (!pixelId || !/^\d+$/.test(pixelId)) return false;
    return window.localStorage.getItem(`enterfly:meta-checkout:${pixelId}:${orderId}`) === "1";
  } catch { return false; }
}

function deliver(name: MetaEvent, payload: EcommercePayload | Record<string, never>, eventId: string): void {
  try {
    const current = state();
    if (!current || !eventId) return;
    const key = `${name}:${eventId}`;
    if (current.sent.has(key)) return;
    if (!current.consent) { current.sent.add(key); return; }
    if (!initializeMetaPixel(current.pixelId ?? undefined)) return;
    window.fbq?.("track", name, payload, { eventID: eventId });
    current.sent.add(key);
  } catch { /* Never propagate SDK/storage failures into commerce. */ }
}

export function trackPageView(route: string): void {
  try { deliver("PageView", {}, getNavigationEventId("page", route)); } catch { /* Best effort. */ }
}
function trackItems(name: Exclude<MetaEvent, "PageView">, items: readonly CommerceItem[], currency: CurrencyCode, eventId: string, value?: number): void {
  try {
    const payload = buildEcommercePayload(items, currency, value);
    if (payload) deliver(name, payload, eventId);
  } catch { /* Payload failures must not change successful commerce actions. */ }
}
export function trackViewContent(item: CommerceItem, eventId: string, currency: CurrencyCode = BASE_CURRENCY): void {
  trackItems("ViewContent", [{ ...item, quantity: 1 }], currency, eventId);
}
export function trackAddToCart(item: CommerceItem, eventId: string, currency: CurrencyCode = BASE_CURRENCY): void {
  trackItems("AddToCart", [item], currency, eventId);
}
export function trackLocalCartAddition(before: readonly CommerceItem[], after: readonly CommerceItem[], eventId: string): void {
  try { trackItems("AddToCart", localCartAddedItems(before, after), BASE_CURRENCY, eventId); } catch { /* Best effort. */ }
}
export function trackInitiateCheckout(snapshot: CommerceSnapshot, eventId: string): void {
  trackItems("InitiateCheckout", snapshot.items, snapshot.currency, eventId, snapshot.value);
}
/**
 * Purchase stays in our consent-aware pending map until the SDK can receive it.
 * A successful synchronous handoff is not a receipt or acceptance from Meta.
 */
function flushPendingPurchases(current: PixelState): void {
  if (!current.consent || !current.initialized || !current.pixelId || !window.fbq?.callMethod) return;
  for (const [eventId, payload] of current.pendingPurchases) {
    const key = `Purchase:${eventId}`;
    if (current.sent.has(key)) { current.pendingPurchases.delete(eventId); continue; }
    if (current.purchaseHandoffs.has(eventId)) continue;
    const storageKey = `enterfly:meta-purchase:${current.pixelId}:${eventId}`;
    try {
      // Keep historical markers suppressed: their former queue/handoff status
      // cannot be recovered safely. New attempts persist only SDK handoffs.
      if (window.localStorage.getItem(storageKey)) {
        current.sent.add(key);
        current.pendingPurchases.delete(eventId);
        logPurchaseDiagnostic({ eventId, source: "browser", validation: "valid", status: "duplicate" });
        continue;
      }
    } catch { /* Memory and the shared eventID still provide deduplication. */ }
    current.purchaseHandoffs.add(eventId);
    try {
      // The third-party SDK cannot mutate the saved retry snapshot, including
      // catalog arrays, if it changes parameters before a failed handoff.
      const handoffPayload: PurchaseEventParameters = {
        ...payload,
        ...(payload.content_ids ? { content_ids: [...payload.content_ids] } : {}),
        ...(payload.variant_ids ? { variant_ids: [...payload.variant_ids] } : {}),
        ...(payload.contents ? { contents: payload.contents.map((item) => ({ ...item })) } : {}),
      };
      // Scope Purchase to our configured data source, even if another integration initializes a Pixel.
      window.fbq("trackSingle", current.pixelId, "Purchase", handoffPayload, { eventID: eventId });
      current.sent.add(key);
      current.pendingPurchases.delete(eventId);
      try { window.localStorage.setItem(storageKey, "sdk_handoff"); } catch { /* Optional browser persistence. */ }
      logPurchaseDiagnostic({ eventId, source: "browser", validation: "valid", status: "sdk_handoff" });
    } catch {
      logPurchaseDiagnostic({ eventId, source: "browser", validation: "valid", status: "delivery_failed" });
    } finally { current.purchaseHandoffs.delete(eventId); }
  }
}

/** Only a complete server-verified purchase snapshot may enter the final boundary. */
export function trackPurchase(snapshot: unknown, eventId: string): void {
  try {
    const result = validatePurchaseSnapshot(snapshot);
    if (!result.valid) {
      logPurchaseDiagnostic({ eventId, source: "browser", validation: "invalid", status: "suppressed", reason: result.reason });
      return;
    }
    if (result.payload.eventId !== eventId) {
      logPurchaseDiagnostic({ eventId, source: "browser", validation: "invalid", status: "suppressed", reason: "event_id_mismatch" });
      return;
    }
    const current = state();
    if (!current) return;
    const key = `Purchase:${eventId}`;
    if (current.sent.has(key)) return;
    if (!current.consent) {
      current.sent.add(key);
      logPurchaseDiagnostic({ eventId, source: "browser", validation: "valid", status: "consent_denied" });
      return;
    }
    // Capture once: retries and cart clearing cannot replace this order's amount.
    if (!current.pendingPurchases.has(eventId)) {
      const payload = buildPurchaseEventParameters(result.payload);
      if (!payload) return;
      current.pendingPurchases.set(eventId, payload);
      logPurchaseDiagnostic({ eventId, source: "browser", validation: "valid", status: "queued" });
    }
    if (!initializeMetaPixel(current.pixelId ?? undefined)) {
      logPurchaseDiagnostic({ eventId, source: "browser", validation: "valid", status: "unavailable" });
    }
  } catch { /* Payload, SDK, and storage failures must not change successful orders. */ }
}
