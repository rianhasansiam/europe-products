import { createElement } from "react";
import { renderToStaticMarkup } from "./helpers/intl";
import { describe, expect, it } from "vitest";

import CheckoutHeader from "@/app/(shop)/checkout/components/CheckoutHeader";
import CustomerForm, { type CustomerFormState } from "@/app/(shop)/checkout/components/CustomerForm";
import OrderSummaryCard from "@/app/(shop)/checkout/components/OrderSummaryCard";

const form: CustomerFormState = {
  customerName: "Buyer", customerPhone: "01700000000", customerEmail: "buyer@example.test",
  customerAddress: "12 Main Road", customerCity: "Dhaka", deliveryZone: "",
  customerPostalCode: "", customerNote: "",
};

function renderForm(
  isAuthenticated: boolean,
  overrides: Partial<CustomerFormState> = {},
  errors: Partial<Record<keyof CustomerFormState, string>> = {},
) {
  return renderToStaticMarkup(createElement(CustomerForm, {
    form: { ...form, ...overrides }, isAuthenticated, onChange: () => {}, errors, profileStatus: "idle", onRetryProfile: () => {},
  }));
}

describe("guest checkout delivery form", () => {
  it.each([false, true])("starts with an unselected required delivery area for authenticated=%s", (isAuthenticated) => {
    const markup = renderForm(isAuthenticated);
    const select = markup.match(/<select[^>]*>[\s\S]*?<\/select>/)?.[0];
    const placeholder = select?.match(/<option[^>]*value=""[^>]*>Select delivery area<\/option>/)?.[0];

    expect(select).toMatch(/\srequired(?:=|\s|\/?>)/);
    expect(placeholder).toMatch(/\sdisabled(?:=|\s|\/?>)/);
    expect(placeholder).toMatch(/\sselected(?:=|\s|\/?>)/);
    expect(select).not.toMatch(/<option[^>]*value="INSIDE_DHAKA"[^>]*selected/);
    expect(select).not.toMatch(/<option[^>]*value="OUTSIDE_DHAKA"[^>]*selected/);
  });

  it("renders the chosen outside-Dhaka option and the delivery-area validation message", () => {
    const selected = renderForm(false, { deliveryZone: "OUTSIDE_DHAKA" });
    expect(selected).toMatch(/<option[^>]*value="OUTSIDE_DHAKA"[^>]*selected/);

    const invalid = renderForm(false, {}, { deliveryZone: "Select a delivery area." });
    expect(invalid).toContain("Select a delivery area.");
  });

  it("shows a useful waiting prompt and disables order placement before selecting a delivery area", () => {
    const markup = renderToStaticMarkup(createElement(OrderSummaryCard, {
      deliveryAreaSelected: false, summary: null, items: [], isLoading: false,
      promoCode: "", appliedPromo: null, onPromoCodeChange: () => {}, onApplyPromo: () => {},
      onRemovePromo: () => {}, promoFeedback: null, onPlaceOrder: () => {}, isPlacing: false,
      submitError: null, paymentMethod: "AIRWALLEX", airwallexPaymentQuote: null,
    }));
    const placeOrderButton = markup.match(/<button[^>]*>[\s\S]*?<\/button>/g)?.find((button) => button.includes("Pay securely with Airwallex"));

    expect(markup).toContain("Select a delivery area to calculate your total.");
    expect(placeOrderButton).toMatch(/^<button[^>]*\sdisabled(?:=|\s|\/?>)/);
    expect(markup).not.toContain("Calculating totals");
    expect(markup).not.toContain("Delivery inside Dhaka");
    expect(markup).not.toContain("Delivery outside Dhaka");
  });

  it("offers an editable optional guest email without account settings", () => {
    const markup = renderForm(false);
    const email = markup.match(/<input[^>]*type="email"[^>]*>/)?.[0];
    expect(email).toBeDefined();
    expect(email).toContain('value="buyer@example.test"');
    expect(email).not.toMatch(/\sreadOnly(?:=|\s|\/?>)/);
    expect(email).not.toMatch(/\sdisabled(?:=|\s|\/?>)/);
    expect(markup).toContain("Email (optional)");
    expect(markup).not.toContain("/profile?tab=settings");
  });

  it("keeps the account email locked and the profile settings link for signed-in buyers", () => {
    const markup = renderForm(true);
    const email = markup.match(/<input[^>]*type="email"[^>]*>/)?.[0];
    expect(email).toMatch(/\sreadOnly(?:=|\s|\/?>)/);
    expect(email).toMatch(/\sdisabled(?:=|\s|\/?>)/);
    expect(markup).toContain("/profile?tab=settings");
  });

  it("shows optional sign-in with the original checkout destination for guests", () => {
    const loginHref = "/login?callbackUrl=%2Fcheckout%3Fbuy%3Dproduct-1%253A2%253Avariant-1";
    const markup = renderToStaticMarkup(createElement(CheckoutHeader, {
      isAuthenticated: false, itemCount: 2, source: "buy-now", loginHref,
    }));
    expect(markup).toContain("Checkout as a guest");
    expect(markup).toContain("Sign in (optional)");
    expect(markup).toContain(loginHref);
  });
});
