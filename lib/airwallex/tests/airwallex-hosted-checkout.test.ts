import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const airwallexSdk = vi.hoisted(() => ({
  init: vi.fn(),
  redirectToCheckout: vi.fn(),
}));

vi.mock("@airwallex/components-sdk", () => ({
  init: airwallexSdk.init,
}));

import { startAirwallexHostedCheckout } from "../components/AirwallexPayButton";

describe("Airwallex Hosted Payment Page checkout", () => {
  beforeEach(() => {
    airwallexSdk.init.mockResolvedValue({
      payments: {
        redirectToCheckout: airwallexSdk.redirectToCheckout,
      },
    });
    airwallexSdk.redirectToCheckout.mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("omits app-side card-network and payment-method allowlists", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            success: true,
            data: {
              intentId: "int_example_123",
              clientSecret: "client-secret",
              currency: "USD",
              environment: "prod",
              successUrl:
                "https://shop.example.test/orders/payment-return?orderId=order_123",
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );

    await startAirwallexHostedCheckout("order_123");

    expect(airwallexSdk.init).toHaveBeenCalledWith({
      env: "prod",
      enabledElements: ["payments"],
    });
    expect(airwallexSdk.redirectToCheckout).toHaveBeenCalledOnce();

    const [redirectOptions] = airwallexSdk.redirectToCheckout.mock.calls[0];
    expect(redirectOptions).toEqual({
      mode: "payment",
      intent_id: "int_example_123",
      client_secret: "client-secret",
      currency: "USD",
      successUrl:
        "https://shop.example.test/orders/payment-return?orderId=order_123",
    });
    expect(redirectOptions).not.toHaveProperty("allowedCardNetworks");
    expect(redirectOptions).not.toHaveProperty("methods");
  });
});
