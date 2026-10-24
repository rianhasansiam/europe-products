
import type { Metadata } from "next";

import PolicyContactBlock from "@/components/policy/PolicyContactBlock";
import PolicyLayout from "@/components/policy/PolicyLayout";
import PolicyList from "@/components/policy/PolicyList";
import PolicySection from "@/components/policy/PolicySection";
import { buildLocalizedMetadata } from "@/lib/seo/localized-metadata";
import { siteConfig } from "@/lib/seo/site";

export const revalidate = 21600;

/**
 * Return Policy page.
 *
 * IMPORTANT: This is a professional starting template tailored to the
 * current SexToy checkout flow (USD payments through Airwallex). Please have a qualified legal professional review and
 * adapt the content to your jurisdiction before going to production.
 */

export async function generateMetadata(): Promise<Metadata> {
  return buildLocalizedMetadata({
  title: "Return Policy",
  description: `Learn about ${siteConfig.name}'s return and refund policy, including eligibility, time limits, and how to request a return or exchange.`,
  path: "/return-policy",
  keywords: ["return policy", "refund", "exchange", "returns", siteConfig.name],
}, "InterfaceReturnPolicyPage");
}

const LAST_UPDATED = "2026-10-24";

export default function ReturnPolicyPage() {
  // Contractual content stays in its original language until a reviewed translation is published.
  const i18n = (source: string) => source;
  return (
    <PolicyLayout
      title={i18n("Return Policy")}
      description={`We want you to love every purchase from ${siteConfig.name}. If something isn't right, this policy explains how returns, exchanges, and refunds work.`}
      lastUpdated={LAST_UPDATED}
      currentPath="/return-policy"
    >
      <PolicySection
        title={i18n("1. Overview")}
        intro={`This Return Policy applies to all orders placed on ${siteConfig.name}. By placing an order, you agree to the terms set out below. Specific product categories may have additional rules, which will be noted on the product page or during checkout.`}
      />

      <PolicySection
        title={i18n("2. Return Eligibility")}
        intro="A product is eligible for return when all of the following conditions are met:"
      >
        <PolicyList
          items={[
            "The return request is made within the allowed time window (see Section 3)",
            "The product is unused, undamaged, and in its original condition",
            "All original tags, labels, accessories, and free items are included",
            "The product is returned in its original packaging where possible",
            "Proof of purchase (order ID, invoice, or order confirmation email) is provided",
          ]}
        />
      </PolicySection>

      <PolicySection
        title={i18n("3. Return Request Time Limit")}
        intro="Return requests must be initiated within 7 (seven) days from the date of delivery."
      >
        <p>
          {i18n("Requests submitted after this window may not be accepted, except in cases of a verified manufacturing defect or where required by applicable law. To start a return, please contact our customer support team with your order ID and a brief description of the issue.")}</p>
      </PolicySection>

      <PolicySection
        title={i18n("4. Product Condition Requirements")}
        intro="To keep returns fair for everyone, returned items must arrive at our facility in resellable condition."
      >
        <PolicyList
          items={[
            "No signs of wear, washing, or use",
            "No scratches, dents, or damage caused after delivery",
            "All seals, stickers, and protective films intact where applicable",
            "Original box, manuals, warranty cards, and accessories included",
          ]}
        />
        <p>
          {i18n("If a returned product fails our quality inspection, we reserve the right to refuse the return or apply a partial refund reflecting the reduced condition of the item.")}</p>
      </PolicySection>

      <PolicySection
        title={i18n("5. Non-Returnable Items")}
        intro="For hygiene, safety, and product integrity reasons, the following items are not eligible for return or exchange (unless damaged or incorrect on arrival):"
      >
        <PolicyList
          items={[
            "Innerwear, lingerie, swimwear, and similar personal garments",
            "Cosmetics, skincare, and personal care items once opened or used",
            "Food, beverages, and other perishable goods",
            "Custom-made, personalized, or made-to-order products",
            "Digital products, downloadable content, and gift cards",
            "Items marked as \"Final Sale\" or \"Non-returnable\" on the product page",
          ]}
        />
      </PolicySection>

      <PolicySection
        title={i18n("6. Damaged, Defective, or Wrong Products")}
        intro="If your order arrives damaged, defective, or different from what you ordered, we're sorry — and we'll make it right."
      >
        <PolicyList
          items={[
            "Contact our customer support within 48 hours of delivery",
            "Share your order ID and clear photos or a short video of the issue",
            "Keep the original packaging until the issue is resolved",
            "Do not use the item if it appears unsafe or unsealed",
          ]}
        />
        <p>
          {i18n("Once verified, we will offer a replacement, exchange, or refund at no extra cost to you, based on stock availability and your preference.")}</p>
      </PolicySection>

      <PolicySection
        title={i18n("7. Refund and Exchange Process")}
        intro="Once your return is received and inspected, we'll notify you of the outcome."
      >
        <PolicyList
          items={[
            "Approved returns are processed within 5–10 business days after inspection",
            "Refunds are issued to the original payment method where available",
            "Exchanges are subject to product availability; if unavailable, a refund will be offered",
            "Shipping fees from the original order are non-refundable, unless the return is due to our error",
            "Return shipping costs may be borne by the customer, except for damaged, defective, or wrong items",
          ]}
        />
      </PolicySection>

      <PolicySection
        title={i18n("8. Cancellations")}
        intro="You may request to cancel an order before it has been shipped."
      >
        <p>
          {i18n("Once an order has been handed over to our courier partner, it can no longer be cancelled but may still be eligible for return under the conditions described above. To request a cancellation, contact our customer support as soon as possible with your order ID.")}</p>
      </PolicySection>

      <PolicySection
        title={i18n("9. How to Request a Return")}
        intro="Starting a return is simple."
      >
        <PolicyList
          items={[
            "Reach out to our customer support team using the contact details below",
            "Share your order ID, the item(s) you want to return, and the reason for the return",
            "Attach clear photos if the issue involves damage or a wrong item",
            "Our team will guide you through the next steps, including pickup or drop-off instructions",
          ]}
        />
      </PolicySection>

      <PolicySection
        title={i18n("10. Customer Support")}
        intro="Our team is here to help with any return-related question."
      >
        <PolicyContactBlock />
      </PolicySection>
    </PolicyLayout>
  );
}
