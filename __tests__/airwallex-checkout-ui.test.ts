import { createElement } from "react";
import { renderToStaticMarkup } from "./helpers/intl";
import { describe, expect, it } from "vitest";
import PaymentMethodPicker from "@/app/(shop)/checkout/components/PaymentMethodPicker";

describe("Airwallex checkout", () => {
  it("shows the sole payment provider", () => {
    const markup = renderToStaticMarkup(createElement(PaymentMethodPicker, { airwallexEnabled: true }));
    expect(markup).toContain("Airwallex secure payment");
    expect(markup).not.toContain("Cash on delivery"); expect(markup).not.toContain("SSLCommerz");
  });
  it("explains unavailable payments without offering another provider", () => {
    const markup = renderToStaticMarkup(createElement(PaymentMethodPicker, { airwallexEnabled: false }));
    expect(markup).toContain("Payments are temporarily unavailable");
  });
});
