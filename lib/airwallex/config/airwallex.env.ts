import "server-only";

import { z } from "zod";

import {
  isAirwallexHttpsUrl,
  isAirwallexReturnUrl,
} from "../security/airwallex-return-url";

const DEFAULTS = {
  sandboxApiBaseUrl: "https://api.sandbox.airwallex.com",
  productionApiBaseUrl: "https://api.airwallex.com",
  httpTimeoutMs: "10000",
  webhookToleranceSeconds: "300",
  returnUrl: "https://sextoybd.net/orders/payment-return",
} as const;

const optionalSecret = (minimumLength = 1) =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") return undefined;
      const normalized = value.trim();
      return normalized || undefined;
    },
    z.string().min(minimumLength).optional(),
  );

const positiveInteger = (minimum: number, maximum: number) =>
  z.coerce.number().int().min(minimum).max(maximum);

const rawEnvironmentSchema = z
  .object({
    AIRWALLEX_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    AIRWALLEX_ENV: z.enum(["sandbox", "production"]).default("sandbox"),
    AIRWALLEX_CLIENT_ID: optionalSecret(),
    AIRWALLEX_API_KEY: optionalSecret(),
    AIRWALLEX_WEBHOOK_SECRET: optionalSecret(16),
    AIRWALLEX_SANDBOX_API_BASE_URL: z
      .string()
      .url()
      .refine(
        isAirwallexHttpsUrl,
        "Sandbox API URL must be a secure HTTPS URL.",
      )
      .default(DEFAULTS.sandboxApiBaseUrl),
    AIRWALLEX_PRODUCTION_API_BASE_URL: z
      .string()
      .url()
      .refine(
        isAirwallexHttpsUrl,
        "Production API URL must be a secure HTTPS URL.",
      )
      .default(DEFAULTS.productionApiBaseUrl),
    AIRWALLEX_HTTP_TIMEOUT_MS: positiveInteger(1_000, 60_000).default(
      Number(DEFAULTS.httpTimeoutMs),
    ),
    AIRWALLEX_WEBHOOK_TOLERANCE_SECONDS: positiveInteger(30, 3_600).default(
      Number(DEFAULTS.webhookToleranceSeconds),
    ),
    AIRWALLEX_RECONCILIATION_SECRET: optionalSecret(32),
    AIRWALLEX_RETURN_URL: z.string().url().default(DEFAULTS.returnUrl),
    NODE_ENV: z.string().default("development"),
  })
  .superRefine((value, context) => {
    if (
      !isAirwallexReturnUrl(
        value.AIRWALLEX_RETURN_URL,
        value.AIRWALLEX_ENV,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["AIRWALLEX_RETURN_URL"],
        message: "Airwallex return URL is not trusted.",
      });
    }

    if (!value.AIRWALLEX_ENABLED) return;

    const required = [
      ["AIRWALLEX_CLIENT_ID", value.AIRWALLEX_CLIENT_ID],
      ["AIRWALLEX_API_KEY", value.AIRWALLEX_API_KEY],
      ["AIRWALLEX_WEBHOOK_SECRET", value.AIRWALLEX_WEBHOOK_SECRET],
      [
        "AIRWALLEX_RECONCILIATION_SECRET",
        value.AIRWALLEX_RECONCILIATION_SECRET,
      ],
    ] as const;
    for (const [name, secret] of required) {
      if (!secret) {
        context.addIssue({
          code: "custom",
          path: [name],
          message: `${name} is required when Airwallex is enabled.`,
        });
      }
    }
  });

export type AirwallexEnvironmentSource = Record<string, string | undefined>;

export type AirwallexEnvironment = {
  enabled: boolean;
  environment: "sandbox" | "production";
  browserEnvironment: "demo" | "prod";
  clientId: string | null;
  apiKey: string | null;
  webhookSecret: string | null;
  apiBaseUrl: string;
  sandboxApiBaseUrl: string;
  productionApiBaseUrl: string;
  httpTimeoutMs: number;
  webhookToleranceSeconds: number;
  reconciliationSecret: string | null;
  returnUrl: string;
};

/** Parse only the Airwallex keys; secret values are never interpolated in errors. */
export function parseAirwallexEnvironment(
  source: AirwallexEnvironmentSource,
): AirwallexEnvironment {
  const parsed = rawEnvironmentSchema.parse({
    AIRWALLEX_ENABLED: source.AIRWALLEX_ENABLED,
    AIRWALLEX_ENV: source.AIRWALLEX_ENV,
    AIRWALLEX_CLIENT_ID: source.AIRWALLEX_CLIENT_ID,
    AIRWALLEX_API_KEY: source.AIRWALLEX_API_KEY,
    AIRWALLEX_WEBHOOK_SECRET: source.AIRWALLEX_WEBHOOK_SECRET,
    AIRWALLEX_SANDBOX_API_BASE_URL:
      source.AIRWALLEX_SANDBOX_API_BASE_URL,
    AIRWALLEX_PRODUCTION_API_BASE_URL:
      source.AIRWALLEX_PRODUCTION_API_BASE_URL,
    AIRWALLEX_HTTP_TIMEOUT_MS: source.AIRWALLEX_HTTP_TIMEOUT_MS,
    AIRWALLEX_WEBHOOK_TOLERANCE_SECONDS:
      source.AIRWALLEX_WEBHOOK_TOLERANCE_SECONDS,
    AIRWALLEX_RECONCILIATION_SECRET:
      source.AIRWALLEX_RECONCILIATION_SECRET,
    AIRWALLEX_RETURN_URL: source.AIRWALLEX_RETURN_URL,
    NODE_ENV: source.NODE_ENV,
  });

  const sandboxApiBaseUrl = parsed.AIRWALLEX_SANDBOX_API_BASE_URL.replace(
    /\/$/,
    "",
  );
  const productionApiBaseUrl =
    parsed.AIRWALLEX_PRODUCTION_API_BASE_URL.replace(/\/$/, "");

  return Object.freeze({
    enabled: parsed.AIRWALLEX_ENABLED,
    environment: parsed.AIRWALLEX_ENV,
    browserEnvironment:
      parsed.AIRWALLEX_ENV === "sandbox" ? "demo" : "prod",
    clientId: parsed.AIRWALLEX_CLIENT_ID ?? null,
    apiKey: parsed.AIRWALLEX_API_KEY ?? null,
    webhookSecret: parsed.AIRWALLEX_WEBHOOK_SECRET ?? null,
    apiBaseUrl:
      parsed.AIRWALLEX_ENV === "sandbox"
        ? sandboxApiBaseUrl
        : productionApiBaseUrl,
    sandboxApiBaseUrl,
    productionApiBaseUrl,
    httpTimeoutMs: parsed.AIRWALLEX_HTTP_TIMEOUT_MS,
    webhookToleranceSeconds:
      parsed.AIRWALLEX_WEBHOOK_TOLERANCE_SECONDS,
    reconciliationSecret:
      parsed.AIRWALLEX_RECONCILIATION_SECRET ?? null,
    returnUrl: parsed.AIRWALLEX_RETURN_URL,
  });
}
