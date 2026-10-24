"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { useRef, useState } from "react";
import { CreditCard } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { readApiData } from "@/features/http/api-envelope";

import { airwallexHostedPaymentPageConfigSchema } from "../schemas/airwallex.schemas";
import type { AirwallexHostedPaymentPageConfig } from "../types/airwallex.types";

const INITIATION_ERROR =
  "We couldn't open secure payment. Please try again from this order.";

/**
 * Request a short-lived browser configuration and immediately hand it to the
 * Airwallex Hosted Payment Page SDK. The client secret is kept in memory only.
 */
export async function startAirwallexHostedCheckout(
  orderId: string,
): Promise<void> {
  const normalizedOrderId = orderId.trim();
  if (!normalizedOrderId) throw new Error(INITIATION_ERROR);

  let config: AirwallexHostedPaymentPageConfig;
  try {
    const response = await fetch("/api/payments/airwallex/initiate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: normalizedOrderId }),
      cache: "no-store",
    });
    const payload = await readApiData<unknown>(response, INITIATION_ERROR);
    const parsed = airwallexHostedPaymentPageConfigSchema.safeParse(payload);
    if (!parsed.success) throw new Error(INITIATION_ERROR);
    config = parsed.data;
  } catch {
    throw new Error(INITIATION_ERROR);
  }

  try {
    const { init } = await import("@airwallex/components-sdk");
    const { payments } = await init({
      env: config.environment,
      enabledElements: ["payments"],
    });
    if (!payments) throw new Error(INITIATION_ERROR);

    // Keep card networks and payment methods account-driven. Adding either
    // allowlist here would hide otherwise eligible options from the HPP.
    const redirectError = payments.redirectToCheckout({
      mode: "payment",
      intent_id: config.intentId,
      client_secret: config.clientSecret,
      currency: config.currency,
      successUrl: config.successUrl,
      ...(config.countryCode ? { country_code: config.countryCode } : {}),
    });
    if (typeof redirectError === "string" && redirectError.trim()) {
      throw new Error(INITIATION_ERROR);
    }
  } catch {
    throw new Error(INITIATION_ERROR);
  }
}

type AirwallexPayButtonProps = Omit<
  ButtonProps,
  "children" | "loading" | "loadingText" | "onClick" | "type"
> & {
  orderId: string;
  label?: string;
  loadingLabel?: string;
  onError?: (message: string) => void;
};

export function AirwallexPayButton({
  orderId,
  label = "Pay securely with Airwallex",
  loadingLabel = "Opening secure payment...",
  onError,
  disabled,
  ...buttonProps
}: AirwallexPayButtonProps) {
  const i18n = useInterfaceTranslations("InterfaceAirwallexComponentsAirwallexPayButton");
  const inFlightRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (disabled || inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);
    setError(null);

    try {
      await startAirwallexHostedCheckout(orderId);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : INITIATION_ERROR;
      setError(message);
      onError?.(message);
      inFlightRef.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <Button
        {...buttonProps}
        type="button"
        disabled={disabled}
        loading={loading}
        loadingText={loadingLabel}
        onClick={handleClick}
      >
        <CreditCard aria-hidden="true" />
        {i18n(label)}
      </Button>
      <p
        className="mt-2 text-xs font-medium text-rose-700"
        role={error ? "alert" : undefined}
        aria-live="polite"
      >
        {error ?? (loading ? i18n("Redirecting to Airwallex's secure checkout.") : "")}
      </p>
    </div>
  );
}
