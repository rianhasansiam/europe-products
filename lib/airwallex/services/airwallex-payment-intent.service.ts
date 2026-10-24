import "server-only";

import { randomUUID } from "node:crypto";

import {
  airwallexConfig,
  requireAirwallexConfig,
} from "../config/airwallex.config";
import { AIRWALLEX_API_PATHS } from "../constants/airwallex.constants";
import { AirwallexApiError } from "../errors/airwallex.errors";
import {
  airwallexPaymentIntentCreateRequestSchema,
  airwallexPaymentIntentCreateResponseSchema,
  airwallexPaymentIntentIdSchema,
  airwallexPaymentIntentRetrieveResponseSchema,
} from "../schemas/airwallex.schemas";
import type {
  AirwallexPaymentIntentCreateRequest,
  AirwallexPaymentIntentCreateResponse,
  AirwallexPaymentIntentRetrieveResponse,
} from "../types/airwallex.types";
import { AirwallexHttpClient } from "../client/airwallex-http.client";
import { airwallexTokenService } from "../client/airwallex-token.service";

const httpClient = new AirwallexHttpClient(airwallexConfig);

async function authorizedRequest<T>(
  path: string,
  options: Parameters<AirwallexHttpClient["request"]>[1],
): Promise<T> {
  let token = await airwallexTokenService.getAccessToken();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return (await httpClient.request(path, {
        ...options,
        headers: {
          ...Object.fromEntries(new Headers(options.headers).entries()),
          Authorization: `Bearer ${token}`,
        },
      })) as T;
    } catch (error) {
      if (
        attempt === 0 &&
        error instanceof AirwallexApiError &&
        error.providerStatus === 401
      ) {
        airwallexTokenService.clearAccessToken(token);
        token = await airwallexTokenService.getAccessToken();
        continue;
      }
      throw error;
    }
  }
  throw new AirwallexApiError();
}

export async function createAirwallexPaymentIntent(
  input: AirwallexPaymentIntentCreateRequest,
): Promise<AirwallexPaymentIntentCreateResponse> {
  requireAirwallexConfig();
  const body = airwallexPaymentIntentCreateRequestSchema.parse(input);
  return authorizedRequest(AIRWALLEX_API_PATHS.createPaymentIntent, {
    method: "POST",
    body,
    responseSchema: airwallexPaymentIntentCreateResponseSchema,
    // Airwallex request_id makes this POST safe to retry with the same body.
    idempotent: true,
    maxRetries: 2,
  });
}

export async function retrieveAirwallexPaymentIntent(
  paymentIntentId: string,
): Promise<AirwallexPaymentIntentRetrieveResponse> {
  requireAirwallexConfig();
  const id = airwallexPaymentIntentIdSchema.parse(paymentIntentId);
  return authorizedRequest(
    `${AIRWALLEX_API_PATHS.paymentIntents}/${encodeURIComponent(id)}`,
    {
      method: "GET",
      responseSchema: airwallexPaymentIntentRetrieveResponseSchema,
      idempotent: true,
      maxRetries: 2,
    },
  );
}

export async function cancelAirwallexPaymentIntent(
  paymentIntentId: string,
): Promise<AirwallexPaymentIntentRetrieveResponse> {
  requireAirwallexConfig();
  const id = airwallexPaymentIntentIdSchema.parse(paymentIntentId);
  return authorizedRequest(
    `${AIRWALLEX_API_PATHS.paymentIntents}/${encodeURIComponent(id)}/cancel`,
    {
      method: "POST",
      body: {
        request_id: randomUUID(),
        cancellation_reason: "Hosted checkout session expired",
      },
      responseSchema: airwallexPaymentIntentRetrieveResponseSchema,
      idempotent: true,
      maxRetries: 2,
    },
  );
}
