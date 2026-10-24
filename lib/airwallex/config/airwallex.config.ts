import "server-only";

import { AirwallexConfigurationError } from "../errors/airwallex.errors";
import {
  parseAirwallexEnvironment,
  type AirwallexEnvironment,
} from "./airwallex.env";

// Parsed once per server instance. Enabled production deployments therefore
// fail during module initialization when credentials are incomplete.
export const airwallexConfig = parseAirwallexEnvironment(process.env);

export function requireAirwallexConfig(): AirwallexEnvironment & {
  clientId: string;
  apiKey: string;
  webhookSecret: string;
  reconciliationSecret: string;
} {
  if (
    !airwallexConfig.enabled ||
    !airwallexConfig.clientId ||
    !airwallexConfig.apiKey ||
    !airwallexConfig.webhookSecret ||
    !airwallexConfig.reconciliationSecret
  ) {
    throw new AirwallexConfigurationError();
  }
  return airwallexConfig as ReturnType<typeof requireAirwallexConfig>;
}

export function buildAirwallexReturnUrls(orderId: string): {
  successUrl: string;
  cancelUrl: string;
} {
  const config = requireAirwallexConfig();
  const base = new URL(config.returnUrl);
  const success = new URL(base);
  success.searchParams.set("orderId", orderId);
  const cancel = new URL(base);
  cancel.searchParams.set("orderId", orderId);
  cancel.searchParams.set("flow", "cancelled");

  if (success.origin !== base.origin || cancel.origin !== base.origin) {
    throw new AirwallexConfigurationError();
  }
  return { successUrl: success.toString(), cancelUrl: cancel.toString() };
}
