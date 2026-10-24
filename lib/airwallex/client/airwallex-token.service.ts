import "server-only";

import { AIRWALLEX_API_PATHS } from "../constants/airwallex.constants";
import { airwallexConfig } from "../config/airwallex.config";
import type { AirwallexEnvironment } from "../config/airwallex.env";
import {
  AirwallexApiError,
  AirwallexAuthenticationError,
} from "../errors/airwallex.errors";
import { airwallexAuthenticationResponseSchema } from "../schemas/airwallex.schemas";
import { AirwallexHttpClient } from "./airwallex-http.client";

type TokenClientConfig = Pick<
  AirwallexEnvironment,
  "clientId" | "apiKey"
>;

type CreateTokenServiceOptions = {
  config: TokenClientConfig;
  httpClient: AirwallexHttpClient;
  now?: () => number;
  refreshSkewMs?: number;
};

export type AirwallexTokenService = {
  getAccessToken(): Promise<string>;
  clearAccessToken(expectedToken?: string): void;
};

/**
 * Per-instance in-memory token cache. Each application instance may obtain its
 * own token; the promise lock prevents a refresh stampede inside one instance.
 */
export function createAirwallexTokenService({
  config,
  httpClient,
  now = Date.now,
  refreshSkewMs = 60_000,
}: CreateTokenServiceOptions): AirwallexTokenService {
  let cached: { token: string; expiresAtMs: number } | null = null;
  let refreshPromise: Promise<string> | null = null;

  const clearAccessToken = (expectedToken?: string) => {
    if (!expectedToken || cached?.token === expectedToken) cached = null;
  };

  const refresh = async (): Promise<string> => {
    if (!config.clientId || !config.apiKey) {
      throw new AirwallexAuthenticationError();
    }
    try {
      const response = await httpClient.request(
        AIRWALLEX_API_PATHS.authenticate,
        {
          method: "POST",
          headers: {
            "x-client-id": config.clientId,
            "x-api-key": config.apiKey,
          },
          responseSchema: airwallexAuthenticationResponseSchema,
          idempotent: true,
          maxRetries: 2,
        },
      );
      const expiresAtMs = Date.parse(response.expires_at);
      if (!Number.isFinite(expiresAtMs) || expiresAtMs <= now() + 5_000) {
        throw new AirwallexAuthenticationError();
      }
      cached = { token: response.token, expiresAtMs };
      return response.token;
    } catch (error) {
      cached = null;
      if (
        error instanceof AirwallexApiError &&
        (error.providerStatus === 401 || error.providerStatus === 403)
      ) {
        throw new AirwallexAuthenticationError();
      }
      throw error;
    }
  };

  return {
    async getAccessToken() {
      if (cached && cached.expiresAtMs - now() > refreshSkewMs) {
        return cached.token;
      }
      if (!refreshPromise) {
        refreshPromise = refresh().finally(() => {
          refreshPromise = null;
        });
      }
      return refreshPromise;
    },
    clearAccessToken,
  };
}

const defaultHttpClient = new AirwallexHttpClient(airwallexConfig);
export const airwallexTokenService = createAirwallexTokenService({
  config: airwallexConfig,
  httpClient: defaultHttpClient,
});
