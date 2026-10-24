import { ServiceError } from "@/lib/services/service-error";
import { jsonError } from "@/lib/api/response";

export type AirwallexErrorCode =
  | "AIRWALLEX_CONFIGURATION_ERROR"
  | "AIRWALLEX_AUTHENTICATION_ERROR"
  | "AIRWALLEX_API_ERROR"
  | "AIRWALLEX_TIMEOUT"
  | "AIRWALLEX_VALIDATION_ERROR"
  | "AIRWALLEX_SIGNATURE_ERROR"
  | "AIRWALLEX_REPLAY_ERROR"
  | "AIRWALLEX_AMOUNT_MISMATCH"
  | "AIRWALLEX_CURRENCY_MISMATCH"
  | "AIRWALLEX_STATE_TRANSITION_ERROR"
  | "AIRWALLEX_PAYMENT_ALREADY_PROCESSED";

export class AirwallexError extends ServiceError {
  readonly code: AirwallexErrorCode;
  readonly retryable: boolean;

  constructor(options: {
    code: AirwallexErrorCode;
    status: number;
    message: string;
    retryable?: boolean;
    details?: Record<string, unknown>;
  }) {
    super(options.status, options.message, {
      code: options.code,
      ...(options.details ?? {}),
    });
    this.name = "AirwallexError";
    this.code = options.code;
    this.retryable = options.retryable ?? false;
  }
}

export class AirwallexConfigurationError extends AirwallexError {
  constructor() {
    super({
      code: "AIRWALLEX_CONFIGURATION_ERROR",
      status: 503,
      message:
        "Airwallex payments are temporarily unavailable. Please try again later.",
    });
    this.name = "AirwallexConfigurationError";
  }
}

export class AirwallexAuthenticationError extends AirwallexError {
  constructor() {
    super({
      code: "AIRWALLEX_AUTHENTICATION_ERROR",
      status: 503,
      message: "Payment authentication is temporarily unavailable.",
      retryable: true,
    });
    this.name = "AirwallexAuthenticationError";
  }
}

export class AirwallexApiError extends AirwallexError {
  readonly providerStatus: number | null;

  constructor(options: {
    providerStatus?: number | null;
    providerCode?: string | null;
    retryable?: boolean;
  } = {}) {
    super({
      code: "AIRWALLEX_API_ERROR",
      status: 502,
      message: "The payment provider could not complete the request.",
      retryable: options.retryable,
      details: options.providerCode
        ? { providerCode: options.providerCode }
        : undefined,
    });
    this.name = "AirwallexApiError";
    this.providerStatus = options.providerStatus ?? null;
  }
}

export class AirwallexTimeoutError extends AirwallexError {
  constructor() {
    super({
      code: "AIRWALLEX_TIMEOUT",
      status: 504,
      message:
        "The payment provider took too long to respond. Your order is safe; please retry.",
      retryable: true,
    });
    this.name = "AirwallexTimeoutError";
  }
}

export class AirwallexValidationError extends AirwallexError {
  constructor(message = "Invalid Airwallex payment request.") {
    super({
      code: "AIRWALLEX_VALIDATION_ERROR",
      status: 400,
      message,
    });
    this.name = "AirwallexValidationError";
  }
}

export class AirwallexSignatureError extends AirwallexError {
  constructor() {
    super({
      code: "AIRWALLEX_SIGNATURE_ERROR",
      status: 401,
      message: "Invalid payment notification signature.",
    });
    this.name = "AirwallexSignatureError";
  }
}

export class AirwallexReplayError extends AirwallexError {
  constructor() {
    super({
      code: "AIRWALLEX_REPLAY_ERROR",
      status: 409,
      message: "Payment notification is outside the accepted time window.",
    });
    this.name = "AirwallexReplayError";
  }
}

export class AirwallexAmountMismatchError extends AirwallexError {
  constructor() {
    super({
      code: "AIRWALLEX_AMOUNT_MISMATCH",
      status: 422,
      message: "Payment verification requires manual review.",
    });
    this.name = "AirwallexAmountMismatchError";
  }
}

export class AirwallexCurrencyMismatchError extends AirwallexError {
  constructor() {
    super({
      code: "AIRWALLEX_CURRENCY_MISMATCH",
      status: 422,
      message: "Payment verification requires manual review.",
    });
    this.name = "AirwallexCurrencyMismatchError";
  }
}

export class AirwallexStateTransitionError extends AirwallexError {
  constructor() {
    super({
      code: "AIRWALLEX_STATE_TRANSITION_ERROR",
      status: 409,
      message: "The payment state changed. Refresh and try again.",
    });
    this.name = "AirwallexStateTransitionError";
  }
}

export class AirwallexPaymentAlreadyProcessedError extends AirwallexError {
  constructor() {
    super({
      code: "AIRWALLEX_PAYMENT_ALREADY_PROCESSED",
      status: 409,
      message: "This order has already been paid.",
    });
    this.name = "AirwallexPaymentAlreadyProcessedError";
  }
}

/**
 * Airwallex endpoints deliberately do not use the application's development
 * error mapper: provider/database errors can contain credentials or payment
 * payloads. This boundary exposes only stable, customer-safe error codes.
 */
export function handleAirwallexApiError(scope: string, error: unknown) {
  if (error instanceof AirwallexError) {
    return jsonError(error.status, error.message, { code: error.code });
  }

  console.error("[payments.airwallex] request failed", {
    scope,
    errorType: error instanceof Error ? error.name : "UnknownError",
  });
  return jsonError(500, "The payment request could not be completed.", {
    code: "AIRWALLEX_API_ERROR",
  });
}
