import {
  asRecord,
  readApiData,
  readApiError,
} from "@/features/http/api-envelope";
import {
  BASE_CURRENCY,
  type CurrencyCode,
} from "@/lib/currency/config";
import type { PublicAirwallexPaymentQuote } from "@/lib/airwallex/services/airwallex-currency.service";
import { registerPurchaseIntent } from "@/lib/analytics/meta-pixel";

export type CheckoutAirwallexPaymentQuote = PublicAirwallexPaymentQuote & {
  quoteToken: string;
};

export type CheckoutPaymentMethod = "AIRWALLEX";
export type DeliveryZone = "INSIDE_DHAKA" | "OUTSIDE_DHAKA";

export type CheckoutItemInput = {
  productId: string;
  variantId?: string;
  quantity: number;
};

export type CheckoutItemPriced = {
  productId: string;
  productCode?: string | null;
  variantId: string;
  sku: string | null;
  variantKey: string;
  variantName: string | null;
  modelNumber: string | null;
  color: string | null;
  size: string | null;
  attributes: Record<string, string> | null;
  attributeSummary: string | null;
  name: string;
  image: string | null;
  quantity: number;
  unitPrice: number;
  originalPrice: number;
  lineTotal: number;
  lineSavings: number;
  baseUnitPrice: number;
  baseOriginalPrice: number;
  baseLineTotal: number;
  baseLineSavings: number;
  stock: number;
};

export type CheckoutSummary = {
  subtotal: number;
  totalSavings: number;
  totalSaved: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  taxRate: number;
  freeShippingThreshold: number;
  shippingFee: number;
  isOutsideDhaka: boolean;
  isFreeShippingApplied: boolean;
  currency: CurrencyCode;
  baseCurrency: typeof BASE_CURRENCY;
  baseSubtotal: number;
  baseTotalSavings: number;
  baseTotalSaved: number;
  baseDiscount: number;
  baseShipping: number;
  baseTax: number;
  baseTotal: number;
  baseFreeShippingThreshold: number;
  baseShippingFee: number;
  exchangeRate: string;
  exchangeRateTimestamp: string | null;
};

export type CheckoutPromo =
  | {
      ok: true;
      code: string;
      description: string | null;
      discount: number;
      baseDiscount: number;
    }
  | {
      ok: false;
      code: string;
      reason: string;
    }
  | null;

export type CheckoutPreview = {
  items: CheckoutItemPriced[];
  summary: CheckoutSummary;
  promo: CheckoutPromo;
  airwallexPaymentQuote: CheckoutAirwallexPaymentQuote | null;
  availablePaymentMethods: CheckoutPaymentMethod[];
};

export type PreviewRequest = {
  items?: CheckoutItemInput[];
  deliveryZone?: DeliveryZone;
  promoCode?: string | null;
};

async function requestCheckoutPreview(
  body: PreviewRequest,
): Promise<CheckoutPreview> {
  const response = await fetch("/api/checkout/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  return readApiData<CheckoutPreview>(
    response,
    "Failed to compute order totals.",
  );
}

let previewBootstrapRequest: Promise<CheckoutPreview> | null = null;
let previewCookiesEstablished = false;

/**
 * The first successful preview installs the browser's HttpOnly guest identity.
 * Queue initial requests so overlapping cart/checkout previews cannot each
 * issue a different identity. Subsequent pricing previews may run in parallel.
 */
export async function fetchCheckoutPreview(
  body: PreviewRequest,
): Promise<CheckoutPreview> {
  if (!previewCookiesEstablished && previewBootstrapRequest) {
    try {
      await previewBootstrapRequest;
    } catch {
      // A failed bootstrap releases the next caller to retry its own choices.
    }
    return fetchCheckoutPreview(body);
  }

  const request = requestCheckoutPreview(body);
  if (previewCookiesEstablished) return request;

  previewBootstrapRequest = request;
  try {
    const preview = await request;
    previewCookiesEstablished = true;
    return preview;
  } finally {
    previewBootstrapRequest = null;
  }
}

export type PlaceOrderRequest = {
  items?: CheckoutItemInput[];
  customerName: string;
  customerPhone: string;
  /** Optional guest contact email. Signed-in checkout uses the account email. */
  customerEmail?: string;
  customerAddress: string;
  customerCity?: string;
  deliveryZone: DeliveryZone;
  customerPostalCode?: string;
  customerNote?: string;
  paymentMethod: CheckoutPaymentMethod;
  promoCode?: string | null;
  clearCart?: boolean;
  /**
   * Stable key for retrying the same checkout submission, including retries.
   * It identifies the attempt only; prices and totals remain server-owned.
   */
  idempotencyKey?: string;
  /** Opaque server-signed quote; it never grants client authority over money. */
  airwallexQuoteToken?: string;
};

export type PlacedOrderResult = {
  // Checkout only relies on this committed identity. Historical monetary
  // details are refetched through the owner-scoped snapshot serializer.
  order: {
    id: string;
    orderNumber: string;
  };
  summary: CheckoutSummary;
  promo: CheckoutPromo;
};

export class CheckoutSubmissionError extends Error {
  readonly orderId: string | null;
  readonly paymentState: string | null;
  readonly fieldErrors: Record<string, string>;

  constructor(
    message: string,
    details: {
      orderId: string | null;
      paymentState: string | null;
      fieldErrors?: Record<string, string>;
    },
  ) {
    super(message);
    this.name = "CheckoutSubmissionError";
    this.orderId = details.orderId;
    this.paymentState = details.paymentState;
    this.fieldErrors = details.fieldErrors ?? {};
  }
}

export async function placeCheckoutOrder(
  body: PlaceOrderRequest,
): Promise<PlacedOrderResult> {
  const submittedPaymentMethod = body.paymentMethod;
  const response = await fetch("/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new CheckoutSubmissionError("Failed to place the order.", {
        orderId: null,
        paymentState: null,
      });
    }
    const details = asRecord(asRecord(payload)?.details);
    const rawFieldErrors = asRecord(
      asRecord(payload)?.fieldErrors ?? details?.fieldErrors,
    );
    const fieldErrors: Record<string, string> = {};
    for (const [field, value] of Object.entries(rawFieldErrors ?? {})) {
      const message = Array.isArray(value)
        ? value.find((entry) => typeof entry === "string" && entry.trim())
        : value;
      if (typeof message === "string" && message.trim()) {
        fieldErrors[field] = message;
      }
    }
    throw new CheckoutSubmissionError(
      readApiError(payload, "Failed to place the order."),
      {
        orderId:
          typeof details?.orderId === "string" ? details.orderId : null,
        paymentState:
          typeof details?.paymentState === "string"
            ? details.paymentState
            : null,
        fieldErrors,
      },
    );
  }

  const result = await readApiData<PlacedOrderResult>(
    response,
    "Failed to place the order.",
  );
  if (submittedPaymentMethod === "AIRWALLEX") {
    registerPurchaseIntent(result.order.id);
  }
  return result;
}

export type CheckoutProfile = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  address: string | null;
  area: string | null;
  postalCode: string | null;
};

export async function fetchCheckoutProfile(): Promise<CheckoutProfile | null> {
  try {
    const response = await fetch("/api/user/me", {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) return null;
    return await readApiData<CheckoutProfile>(
      response,
      "Failed to load profile.",
    );
  } catch {
    return null;
  }
}
