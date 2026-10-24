import { Decimal } from "@prisma/client/runtime/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PaymentTransactionStatus } from "@/app/generated/prisma/client";
import type { PaymentOrderCustomer } from "@/lib/payments/core/payment-order-customer";

const mocks = vi.hoisted(() => ({
  appendTransition: vi.fn(),
  applyAuthoritative: vi.fn(),
  buildReturnUrls: vi.fn(),
  cancelIntent: vi.fn(),
  createAttempt: vi.fn(),
  createIntent: vi.fn(),
  createRequestId: vi.fn(),
  findOrder: vi.fn(),
  getClientIp: vi.fn(),
  lockOrder: vi.fn(),
  lockPayment: vi.fn(),
  logEvent: vi.fn(),
  markEventProcessed: vi.fn(),
  rateLimit: vi.fn(),
  recordStatusHistory: vi.fn(),
  requireConfig: vi.fn(),
  requireUser: vi.fn(),
  retrieveIntent: vi.fn(),
  transaction: vi.fn(),
  validateOrigin: vi.fn(),
}));

vi.mock("@/lib/api/guards", () => ({
  requireUser: mocks.requireUser,
}));

vi.mock("@/lib/auth/rate-limit", () => ({
  getClientIp: mocks.getClientIp,
  rateLimitPersistent: mocks.rateLimit,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: { $transaction: mocks.transaction },
}));

vi.mock("@/lib/orders/mutations", () => ({
  lockOrderForStatusChange: mocks.lockOrder,
  lockPaymentAttempt: mocks.lockPayment,
  recordStatusHistory: mocks.recordStatusHistory,
}));

vi.mock("../config/airwallex.config", () => ({
  buildAirwallexReturnUrls: mocks.buildReturnUrls,
  requireAirwallexConfig: mocks.requireConfig,
}));

vi.mock("../repositories/airwallex-payment.repository", () => ({
  airwallexInitiationOrderInclude: {},
  appendAirwallexTransition: mocks.appendTransition,
  createAirwallexAttempt: mocks.createAttempt,
  findOwnerScopedAirwallexOrder: mocks.findOrder,
  markAirwallexEventProcessed: mocks.markEventProcessed,
}));

vi.mock("../security/airwallex-idempotency", () => ({
  createAirwallexRequestId: mocks.createRequestId,
}));

vi.mock("../security/airwallex-origin-validation", () => ({
  assertAirwallexInitiationOrigin: mocks.validateOrigin,
}));

vi.mock("../security/airwallex-redaction", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../security/airwallex-redaction")
  >();
  return { ...actual, logAirwallexEvent: mocks.logEvent };
});

vi.mock("../services/airwallex-payment-intent.service", () => ({
  cancelAirwallexPaymentIntent: mocks.cancelIntent,
  createAirwallexPaymentIntent: mocks.createIntent,
  retrieveAirwallexPaymentIntent: mocks.retrieveIntent,
}));

vi.mock("../services/airwallex-payment-verification.service", async (
  importOriginal,
) => {
  const actual = await importOriginal<
    typeof import("../services/airwallex-payment-verification.service")
  >();
  return {
    ...actual,
    applyAuthoritativeAirwallexPayment: mocks.applyAuthoritative,
  };
});

import {
  AirwallexApiError,
  AirwallexPaymentAlreadyProcessedError,
  AirwallexStateTransitionError,
  AirwallexTimeoutError,
} from "../errors/airwallex.errors";
import { POST as initiatePaymentHandler } from "../handlers/initiate-payment.handler";
import { initiateAirwallexPayment } from "../services/airwallex-payment-initiation.service";
import type { AirwallexPaymentIntentCreateResponse } from "../types/airwallex.types";

const USER_ID = "user-1";
const ORDER_ID = "order-1";
const REQUEST_ID = "123e4567-e89b-42d3-a456-426614174000";
const RETRY_REQUEST_ID = "223e4567-e89b-42d3-a456-426614174001";
const CLIENT_SECRET = "client-secret-must-not-be-persisted";

type TestPayment = {
  id: string;
  orderId: string;
  provider: string;
  transactionId: string | null;
  idempotencyKey: string | null;
  amount: Decimal;
  currency: string;
  baseAmount: Decimal | null;
  baseCurrency: string | null;
  exchangeRate: Decimal | null;
  exchangeRateAt: Date | null;
  status: PaymentTransactionStatus;
  providerStatus: string | null;
  requiresReview: boolean;
  reviewReason?: string | null;
  failureCode?: string | null;
  failureMessage?: string | null;
  rawResponse?: unknown;
};

type TestOrder = {
  id: string;
  userId: string | null;
  guestAccessTokenHash?: string;
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  currency: string;
  baseCurrency: string;
  displayCurrency: string;
  subtotal: Decimal;
  deliveryCharge: Decimal;
  discountAmount: Decimal;
  taxAmount: Decimal;
  totalAmount: Decimal;
  promoCode: string | null;
  promoCodeUsages: { id: string }[];
  items: {
    id: string;
    variantId: string;
    quantity: number;
    unitPrice: Decimal;
    totalPrice: Decimal;
  }[];
  payments: TestPayment[];
};

type HarnessState = {
  order: TestOrder;
  paymentWrites: unknown[];
  orderWrites: unknown[];
  transitionWrites: unknown[];
};

let state: HarnessState;
let transactionClient: {
  order: {
    findFirst: (input: {
      where: { id: string; userId: string | null; guestAccessTokenHash?: string };
    }) => Promise<TestOrder | null>;
    update: (input: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => Promise<TestOrder>;
    updateMany: (input: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => Promise<{ count: number }>;
  };
  paymentTransaction: {
    findUnique: (input: { where: { id: string } }) => Promise<TestPayment | null>;
    findFirst: (input: {
      where: {
        transactionId?: string;
        id?: { not?: string };
      };
    }) => Promise<{ id: string } | null>;
    update: (input: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => Promise<TestPayment>;
    updateMany: (input: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => Promise<{ count: number }>;
  };
};

function makeOrder(): TestOrder {
  const exchangeRateAt = new Date("2026-08-22T00:00:00.000Z");
  return {
    id: ORDER_ID,
    userId: USER_ID,
    paymentMethod: "AIRWALLEX",
    paymentStatus: "PENDING",
    status: "PENDING",
    currency: "USD",
    baseCurrency: "USD",
    displayCurrency: "USD",
    subtotal: new Decimal("100.05"),
    deliveryCharge: new Decimal("20.50"),
    discountAmount: new Decimal("5.00"),
    taxAmount: new Decimal("10.00"),
    totalAmount: new Decimal("125.55"),
    promoCode: null,
    promoCodeUsages: [],
    items: [
      {
        id: "item-1",
        variantId: "variant-1",
        quantity: 3,
        unitPrice: new Decimal("33.35"),
        totalPrice: new Decimal("100.05"),
      },
    ],
    payments: [
      {
        id: "payment-created",
        orderId: ORDER_ID,
        provider: "AIRWALLEX",
        transactionId: null,
        idempotencyKey: REQUEST_ID,
        amount: new Decimal("125.55"),
        currency: "USD",
        baseAmount: new Decimal("125.55"),
        baseCurrency: "USD",
        exchangeRate: new Decimal("1"),
        exchangeRateAt,
        status: "CREATED",
        providerStatus: "LOCAL_RESERVED",
        requiresReview: false,
      },
    ],
  };
}

function addExistingAttempt(
  overrides: Partial<TestPayment> = {},
): TestPayment {
  const payment: TestPayment = {
    id: "payment-existing",
    orderId: ORDER_ID,
    provider: "AIRWALLEX",
    transactionId: "int_existing123",
    idempotencyKey: REQUEST_ID,
    amount: new Decimal("125.55"),
    currency: "USD",
    baseAmount: new Decimal("125.55"),
    baseCurrency: "USD",
    exchangeRate: new Decimal("1"),
    exchangeRateAt: new Date("2026-08-22T00:00:00.000Z"),
    status: "REQUIRES_PAYMENT_METHOD",
    providerStatus: "REQUIRES_PAYMENT_METHOD",
    requiresReview: false,
    ...overrides,
  };
  state.order.payments = [payment];
  return payment;
}

function providerIntent(
  overrides: Partial<AirwallexPaymentIntentCreateResponse> = {},
): AirwallexPaymentIntentCreateResponse {
  return {
    id: "int_created123",
    request_id: REQUEST_ID,
    amount: 125.55,
    currency: "USD",
    merchant_order_id: ORDER_ID,
    status: "REQUIRES_PAYMENT_METHOD",
    created_at: new Date(Date.now() - 60_000).toISOString(),
    updated_at: new Date().toISOString(),
    client_secret: CLIENT_SECRET,
    ...overrides,
  };
}

function configureTransactionHarness(): void {
  transactionClient = {
    order: {
      findFirst: async ({ where }) =>
        state.order.id === where.id && state.order.userId === where.userId &&
        (where.userId !== null || state.order.guestAccessTokenHash === where.guestAccessTokenHash)
          ? state.order
          : null,
      update: async ({ where, data }) => {
        if (where.id !== state.order.id) throw new Error("Order not found");
        state.orderWrites.push(data);
        Object.assign(state.order, data);
        return state.order;
      },
      updateMany: async ({ where, data }) => {
        if (where.id !== state.order.id) return { count: 0 };
        state.orderWrites.push(data);
        Object.assign(state.order, data);
        return { count: 1 };
      },
    },
    paymentTransaction: {
      findUnique: async ({ where }) =>
        state.order.payments.find((payment) => payment.id === where.id) ?? null,
      findFirst: async ({ where }) => {
        const match = state.order.payments.find(
          (payment) =>
            payment.transactionId === where.transactionId &&
            payment.id !== where.id?.not,
        );
        return match ? { id: match.id } : null;
      },
      update: async ({ where, data }) => {
        const payment = state.order.payments.find(
          (candidate) => candidate.id === where.id,
        );
        if (!payment) throw new Error("Payment not found");
        state.paymentWrites.push(data);
        Object.assign(payment, data);
        return payment;
      },
      updateMany: async ({ where, data }) => {
        const payment = state.order.payments.find(
          (candidate) => candidate.id === where.id,
        );
        if (!payment) return { count: 0 };
        state.paymentWrites.push(data);
        Object.assign(payment, data);
        return { count: 1 };
      },
    },
  };

  mocks.transaction.mockImplementation(
    async (
      callback: (client: typeof transactionClient) => Promise<unknown>,
    ) => callback(transactionClient),
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  state = {
    order: makeOrder(),
    paymentWrites: [],
    orderWrites: [],
    transitionWrites: [],
  };
  configureTransactionHarness();

  mocks.requireConfig.mockReturnValue({ browserEnvironment: "demo" });
  mocks.buildReturnUrls.mockImplementation((orderId: string) => ({
    successUrl: `https://shop.example.test/orders/payment-return?orderId=${orderId}`,
    cancelUrl: `https://shop.example.test/orders/payment-return?orderId=${orderId}&flow=cancelled`,
  }));
  mocks.createRequestId.mockReturnValue(REQUEST_ID);
  mocks.findOrder.mockImplementation(
    async (_client: unknown, orderId: string, customer: PaymentOrderCustomer) =>
      state.order.id === orderId && (typeof customer === "string"
        ? state.order.userId === customer
        : state.order.userId === null && state.order.guestAccessTokenHash === customer.guestAccessTokenHash)
        ? state.order
        : null,
  );
  mocks.createAttempt.mockImplementation(
    async (
      _client: unknown,
      input: {
        orderId: string;
        requestId: string;
        amount: Decimal;
        currency: string;
        baseAmount: Decimal;
        baseCurrency: string;
        exchangeRate: Decimal;
        exchangeRateAt: Date;
      },
    ) => {
      const payment: TestPayment = {
        id: "payment-created",
        orderId: input.orderId,
        provider: "AIRWALLEX",
        transactionId: null,
        idempotencyKey: input.requestId,
        amount: input.amount,
        currency: input.currency,
        baseAmount: input.baseAmount,
        baseCurrency: input.baseCurrency,
        exchangeRate: input.exchangeRate,
        exchangeRateAt: input.exchangeRateAt,
        status: "CREATED",
        providerStatus: "LOCAL_RESERVED",
        requiresReview: false,
      };
      state.order.payments.unshift(payment);
      return payment;
    },
  );
  mocks.appendTransition.mockImplementation(
    async (_client: unknown, input: unknown) => {
      state.transitionWrites.push(input);
      return input;
    },
  );
  mocks.createIntent.mockImplementation(
    async (input: {
      request_id: string;
      amount: number;
      currency: string;
      merchant_order_id: string;
    }) =>
      providerIntent({
        request_id: input.request_id,
        amount: input.amount,
        currency: input.currency,
        merchant_order_id: input.merchant_order_id,
      }),
  );
  mocks.applyAuthoritative.mockResolvedValue({
    orderId: ORDER_ID,
    paymentId: "payment-existing",
    status: "REQUIRES_PAYMENT_METHOD",
    duplicate: true,
    requiresReview: false,
  });
  mocks.cancelIntent.mockResolvedValue(
    providerIntent({ status: "CANCELLED" }),
  );
  mocks.requireUser.mockResolvedValue({
    ok: true,
    session: { user: { id: USER_ID, role: "USER" } },
  });
  mocks.getClientIp.mockReturnValue("203.0.113.10");
  mocks.rateLimit.mockResolvedValue({
    allowed: true,
    remaining: 9,
    resetMs: 60_000,
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("initiateAirwallexPayment", () => {
  it("commits the provider request marker before making the HTTP request", async () => {
    mocks.createIntent.mockImplementation(async () => {
      expect(state.order.payments[0].providerStatus).toBe("CREATE_REQUESTED");
      expect(state.paymentWrites).toContainEqual({ providerStatus: "CREATE_REQUESTED" });
      return providerIntent();
    });
    await initiateAirwallexPayment(USER_ID, ORDER_ID);
  });

  it("rejects an order cancelled before initiation without contacting Airwallex", async () => {
    state.order.status = "CANCELLED";
    state.order.payments[0].status = "CANCELLED";
    state.order.payments[0].providerStatus = "LOCAL_CANCELLED";
    await expect(initiateAirwallexPayment(USER_ID, ORDER_ID)).rejects.toBeInstanceOf(AirwallexStateTransitionError);
    expect(mocks.createIntent).not.toHaveBeenCalled();
  });

  it("initializes a guest payment using its frozen quote and order-scoped hash", async () => {
    const customer = { guestAccessTokenHash: "a".repeat(64) };
    state.order.userId = null;
    state.order.guestAccessTokenHash = customer.guestAccessTokenHash;

    const result = await initiateAirwallexPayment(customer, ORDER_ID);

    expect(result.intentId).toBe("int_created123");
    expect(mocks.createIntent).toHaveBeenCalledWith(expect.objectContaining({ amount: 125.55, currency: "USD", merchant_order_id: ORDER_ID }));
    expect(state.order.payments[0].transactionId).toBe("int_created123");
  });

  it("rejects a different guest hash before contacting Airwallex", async () => {
    state.order.userId = null;
    state.order.guestAccessTokenHash = "a".repeat(64);

    await expect(initiateAirwallexPayment({ guestAccessTokenHash: "b".repeat(64) }, ORDER_ID)).rejects.toMatchObject({ status: 404 });
    expect(mocks.createIntent).not.toHaveBeenCalled();
  });

  it("does not authorize a registered order through a matching guest hash", async () => {
    state.order.guestAccessTokenHash = "a".repeat(64);

    await expect(initiateAirwallexPayment({ guestAccessTokenHash: "a".repeat(64) }, ORDER_ID)).rejects.toMatchObject({ status: 404 });
    expect(mocks.createIntent).not.toHaveBeenCalled();
  });

  it("returns owner-scoped not-found without contacting Airwallex", async () => {
    state.order.userId = "different-owner";

    await expect(
      initiateAirwallexPayment(USER_ID, ORDER_ID),
    ).rejects.toMatchObject({
      code: "AIRWALLEX_VALIDATION_ERROR",
      status: 404,
    });
    expect(mocks.findOrder).toHaveBeenCalledWith(
      transactionClient,
      ORDER_ID,
      USER_ID,
    );
    expect(mocks.createIntent).not.toHaveBeenCalled();
  });

  it("rejects an already-paid order", async () => {
    state.order.paymentStatus = "PAID";

    await expect(
      initiateAirwallexPayment(USER_ID, ORDER_ID),
    ).rejects.toBeInstanceOf(AirwallexPaymentAlreadyProcessedError);
    expect(mocks.createAttempt).not.toHaveBeenCalled();
    expect(mocks.createIntent).not.toHaveBeenCalled();
  });

  it("rejects an order outside the payable status", async () => {
    state.order.status = "CANCELLED";

    await expect(
      initiateAirwallexPayment(USER_ID, ORDER_ID),
    ).rejects.toBeInstanceOf(AirwallexStateTransitionError);
    expect(mocks.createIntent).not.toHaveBeenCalled();
  });

  it("sends the persisted frozen USD quote to Airwallex", async () => {
    const result = await initiateAirwallexPayment(USER_ID, ORDER_ID);

    expect(mocks.createIntent).toHaveBeenCalledWith({
      request_id: REQUEST_ID,
      amount: 125.55,
      currency: "USD",
      merchant_order_id: ORDER_ID,
      return_url: expect.stringContaining(`orderId=${ORDER_ID}`),
      metadata: {
        sextoy_order_id: ORDER_ID,
        sextoy_payment_attempt_id: "payment-created",
        sextoy_base_currency: "USD",
        sextoy_base_amount: "125.55",
        sextoy_display_currency: "USD",
        sextoy_payment_currency: "USD",
        sextoy_exchange_rate: "1",
        sextoy_exchange_rate_at: "2026-08-22T00:00:00.000Z",
      },
    });
    expect(result).toEqual({
      intentId: "int_created123",
      clientSecret: CLIENT_SECRET,
      currency: "USD",
      environment: "demo",
      successUrl: expect.stringContaining(`orderId=${ORDER_ID}`),
      cancelUrl: expect.stringContaining("flow=cancelled"),
    });
    expect(state.order.payments[0]).toMatchObject({
      amount: new Decimal("125.55"),
      currency: "USD",
      baseAmount: new Decimal("125.55"),
      baseCurrency: "USD",
      exchangeRate: new Decimal("1"),
      transactionId: "int_created123",
      status: "REQUIRES_PAYMENT_METHOD",
    });
  });

  it("rejects new payment initiation for a historical non-USD order", async () => {
    state.order.currency = "BDT";
    state.order.baseCurrency = "BDT";
    state.order.displayCurrency = "EUR";
    await expect(initiateAirwallexPayment(USER_ID, ORDER_ID)).rejects.toMatchObject({ code: "AIRWALLEX_VALIDATION_ERROR" });
    expect(mocks.createIntent).not.toHaveBeenCalled();
    expect(mocks.createAttempt).not.toHaveBeenCalled();
  });

  it.each([
    ["provider failure", new AirwallexApiError({ providerStatus: 502 })],
    ["provider timeout", new AirwallexTimeoutError()],
  ])("leaves the order unconfirmed after %s", async (_label, error) => {
    mocks.createIntent.mockRejectedValue(error);

    await expect(
      initiateAirwallexPayment(USER_ID, ORDER_ID),
    ).rejects.toBe(error);
    expect(state.order.paymentStatus).toBe("PENDING");
    expect(state.order.payments).toHaveLength(1);
    expect(state.order.payments[0]).toMatchObject({
      transactionId: null,
      status: "CREATED",
      providerStatus: "CREATE_REQUESTED",
    });
    expect(state.order.paymentStatus).not.toBe("PAID");
    expect(mocks.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "PAYMENT_INTENT_CREATE_REQUESTED",
        orderId: ORDER_ID,
        baseCurrency: "USD",
        displayCurrency: "USD",
        paymentCurrency: "USD",
        baseAmount: "125.55",
        paymentAmount: "125.55",
        exchangeRate: "1",
      }),
    );
  });

  it("terminalizes a definitive provider create rejection", async () => {
    const error = new AirwallexApiError({
      providerStatus: 400,
      providerCode: "currency_not_supported",
    });
    mocks.createIntent.mockRejectedValue(error);

    await expect(
      initiateAirwallexPayment(USER_ID, ORDER_ID),
    ).rejects.toBe(error);

    expect(state.order.paymentStatus).toBe("FAILED");
    expect(state.order.payments[0]).toMatchObject({
      transactionId: null,
      status: "FAILED",
      providerStatus: "CREATE_REJECTED_400",
      failureCode: "CURRENCY_NOT_SUPPORTED",
      requiresReview: false,
    });
    expect(state.transitionWrites).toContainEqual(
      expect.objectContaining({
        eventName: "payment_intent.create_rejected",
        fromStatus: "CREATED",
        toStatus: "FAILED",
        providerStatus: "CREATE_REJECTED_400",
      }),
    );
  });

  it("reuses a fresh existing PaymentIntent without creating another", async () => {
    state.order.paymentStatus = "PENDING";
    addExistingAttempt();
    mocks.retrieveIntent.mockResolvedValue(
      providerIntent({ id: "int_existing123" }),
    );

    const result = await initiateAirwallexPayment(USER_ID, ORDER_ID);

    expect(mocks.retrieveIntent).toHaveBeenCalledWith("int_existing123");
    expect(mocks.applyAuthoritative).toHaveBeenCalledOnce();
    expect(mocks.createIntent).not.toHaveBeenCalled();
    expect(mocks.cancelIntent).not.toHaveBeenCalled();
    expect(result.intentId).toBe("int_existing123");
    expect(result.clientSecret).toBe(CLIENT_SECRET);
  });

  it("cancels a failed attempt's still-active PI before creating a retry", async () => {
    state.order.paymentStatus = "FAILED";
    const failed = addExistingAttempt({ status: "FAILED" });
    mocks.createRequestId.mockReturnValue(RETRY_REQUEST_ID);
    mocks.retrieveIntent.mockResolvedValue(
      providerIntent({ id: "int_existing123" }),
    );
    mocks.cancelIntent.mockResolvedValue(
      providerIntent({ id: "int_existing123", status: "CANCELLED" }),
    );
    mocks.applyAuthoritative.mockImplementation(
      async ({ authoritative }: { authoritative: { providerStatus: string } }) => {
        if (authoritative.providerStatus === "CANCELLED") {
          failed.status = "CANCELLED";
          failed.providerStatus = "CANCELLED";
          return {
            orderId: ORDER_ID,
            paymentId: failed.id,
            status: "CANCELLED",
            duplicate: false,
            requiresReview: false,
          };
        }
        return {
          orderId: ORDER_ID,
          paymentId: failed.id,
          status: "FAILED",
          duplicate: true,
          requiresReview: false,
        };
      },
    );

    const result = await initiateAirwallexPayment(USER_ID, ORDER_ID);

    expect(mocks.cancelIntent).toHaveBeenCalledWith("int_existing123");
    expect(mocks.createIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        request_id: RETRY_REQUEST_ID,
        amount: 125.55,
        currency: "USD",
      }),
    );
    expect(mocks.createAttempt).toHaveBeenCalledWith(
      transactionClient,
      expect.objectContaining({
        requestId: RETRY_REQUEST_ID,
        amount: new Decimal("125.55"),
        currency: "USD",
        baseAmount: new Decimal("125.55"),
        baseCurrency: "USD",
        exchangeRate: new Decimal("1"),
        exchangeRateAt: new Date("2026-08-22T00:00:00.000Z"),
      }),
    );
    expect(result.intentId).toBe("int_created123");
    expect(state.order.payments).toHaveLength(2);
    expect(failed.status).toBe("CANCELLED");
  });

  it("keeps duplicate invocations on one persisted provider request ID", async () => {
    const created = providerIntent();
    mocks.createIntent.mockResolvedValue(created);
    mocks.retrieveIntent.mockResolvedValue(created);

    const first = await initiateAirwallexPayment(USER_ID, ORDER_ID);
    const second = await initiateAirwallexPayment(USER_ID, ORDER_ID);

    expect(first.intentId).toBe(created.id);
    expect(second.intentId).toBe(created.id);
    expect(mocks.createRequestId).not.toHaveBeenCalled();
    expect(mocks.createAttempt).not.toHaveBeenCalled();
    expect(mocks.createIntent).toHaveBeenCalledOnce();
    expect(mocks.createIntent).toHaveBeenCalledWith(
      expect.objectContaining({ request_id: REQUEST_ID }),
    );
    expect(mocks.retrieveIntent).toHaveBeenCalledWith(created.id);
    expect(state.order.payments).toHaveLength(1);
    expect(state.order.payments[0]?.idempotencyKey).toBe(REQUEST_ID);
  });

  it("never passes the client secret to persistence or structured logs", async () => {
    await initiateAirwallexPayment(USER_ID, ORDER_ID);

    const nonResponseSideEffects = JSON.stringify({
      createAttemptCalls: mocks.createAttempt.mock.calls,
      logs: mocks.logEvent.mock.calls,
      orderWrites: state.orderWrites,
      paymentWrites: state.paymentWrites,
      persistedPayments: state.order.payments,
      transitions: state.transitionWrites,
    });
    expect(nonResponseSideEffects).not.toContain(CLIENT_SECRET);
    expect(state.order.payments[0]?.rawResponse).not.toHaveProperty(
      "client_secret",
    );
    expect(mocks.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "PAYMENT_INTENT_CREATED",
        paymentIntentId: "int_created123",
      }),
    );
  });
});

describe("Airwallex initiation handler", () => {
  it("short-circuits unauthenticated callers before validation or payment work", async () => {
    const unauthorized = new Response(
      JSON.stringify({ error: "Authentication required." }),
      { status: 401 },
    );
    mocks.requireUser.mockResolvedValue({ ok: false, response: unauthorized });

    const response = await initiatePaymentHandler(
      new Request("https://shop.example.test/api/payments/airwallex/initiate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId: ORDER_ID }),
      }),
    );

    expect(response).toBe(unauthorized);
    expect(mocks.validateOrigin).not.toHaveBeenCalled();
    expect(mocks.rateLimit).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.createIntent).not.toHaveBeenCalled();
  });
});
