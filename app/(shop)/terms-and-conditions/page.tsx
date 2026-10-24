
import type { Metadata } from "next";

import PolicyContactBlock from "@/components/policy/PolicyContactBlock";
import PolicyLayout from "@/components/policy/PolicyLayout";
import PolicyList from "@/components/policy/PolicyList";
import PolicySection from "@/components/policy/PolicySection";
import { buildLocalizedMetadata } from "@/lib/seo/localized-metadata";
import { siteConfig } from "@/lib/seo/site";

export const revalidate = 21600;

/**
 * Terms & Conditions page.
 *
 * IMPORTANT: This is a professional starting template tailored to the
 * current SexToy platform (credentials + Google login, guest checkout,
 * USD pricing and Airwallex checkout). The content
 * must be reviewed by a qualified legal professional before being used
 * in production, as legal requirements vary by jurisdiction.
 */

export async function generateMetadata(): Promise<Metadata> {
  return buildLocalizedMetadata({
  title: "Terms & Conditions",
  description: `Read the Terms & Conditions that govern your use of ${siteConfig.name}, including ordering, payment, delivery, and customer responsibilities.`,
  path: "/terms-and-conditions",
  keywords: ["terms and conditions", "terms of service", "user agreement", siteConfig.name],
}, "InterfaceTermsAndConditionsPage");
}

const LAST_UPDATED = "2026-08-23";

export default function TermsAndConditionsPage() {
  // Contractual content stays in its original language until a reviewed translation is published.
  const i18n = (source: string) => source;
  return (
    <PolicyLayout
      title={i18n("Terms & Conditions")}
      description={`Welcome to ${siteConfig.name}. These Terms & Conditions govern your access to and use of our website, products, and services. Please read them carefully before placing an order.`}
      lastUpdated={LAST_UPDATED}
      currentPath="/terms-and-conditions"
    >
      <PolicySection
        title={i18n("1. Acceptance of Terms")}
        intro={`By accessing, browsing, or placing an order on ${siteConfig.name} ("the Site"), you agree to be bound by these Terms & Conditions and all applicable laws and regulations. If you do not agree, please do not use the Site.`}
      />

      <PolicySection
        title={i18n("2. Website Usage Rules")}
        intro="When using SexToy, you agree to behave responsibly and lawfully."
      >
        <PolicyList
          items={[
            "Use the Site only for lawful purposes and personal, non-commercial shopping",
            "Do not attempt to gain unauthorized access to accounts, systems, or data",
            "Do not interfere with the security, availability, or normal operation of the Site",
            "Do not upload harmful content, malicious code, or misleading information",
            "Do not scrape, copy, or republish content from the Site without permission",
            "Respect other users when posting reviews, ratings, or messages",
          ]}
        />
        <p>
          {i18n("We reserve the right to suspend or terminate access to any user who violates these rules, without prior notice where necessary.")}</p>
      </PolicySection>

      <PolicySection
        title={i18n("3. Account Responsibility")}
        intro="You may create an account using email & password or by signing in with Google."
      >
        <PolicyList
          items={[
            "You are responsible for providing accurate and up-to-date account information",
            "Keep your login credentials confidential and do not share them with anyone",
            "Notify us immediately if you suspect unauthorized access to your account",
            "You are responsible for all activity that occurs under your account",
            "One person should not maintain multiple accounts to abuse promotions or offers",
          ]}
        />
        <p>
          {i18n("Guest users who place orders without registering are also responsible for the accuracy of the contact, shipping, and order information they provide.")}</p>
      </PolicySection>

      <PolicySection
        title={i18n("4. Product Information and Pricing")}
        intro="We strive to display accurate product details, images, and prices, but errors can occasionally occur."
      >
        <PolicyList
          items={[
            "Product colors and finishes may appear slightly different on different screens",
            "Specifications, availability, and prices are subject to change without notice",
            "All new product prices, delivery charges, discounts, taxes, and payments are in USD",
            "In case of a pricing or stock error, we reserve the right to cancel or correct the order",
            "Promotional offers and coupon codes may have additional terms shown at checkout",
          ]}
        />
      </PolicySection>

      <PolicySection
        title={i18n("5. Order Placement")}
        intro="Placing an order is a two-step process."
      >
        <PolicyList
          items={[
            "You submit an order through the checkout flow, either as a registered user or as a guest",
            "We confirm the order via email or on-site notification once it is accepted and ready to be processed",
            "An order is only legally binding once we issue an acceptance confirmation",
            "We may refuse or cancel orders for reasons including stock unavailability, suspected fraud, or pricing errors",
          ]}
        />
      </PolicySection>

      <PolicySection
        title={i18n("6. Order Cancellation")}
        intro="You may request to cancel an order before it has been shipped."
      >
        <p>
          {i18n("Once your order has been handed over to our courier partner, it cannot be cancelled but may still be eligible for return under our")}{" "}
          <a href="/return-policy" className="font-semibold text-brand-red hover:underline">
            {i18n("Return Policy")}</a>
          {i18n(". We also reserve the right to cancel orders at our discretion, in which case any amount already paid will be refunded.")}</p>
      </PolicySection>

      <PolicySection
        title={i18n("7. Payment Terms")}
        intro="All new orders are paid securely through Airwallex in USD."
      >
        <PolicyList
          items={[
            "Airwallex processes your payment on its hosted checkout page",
            "SexToy does not collect or store your card details",
            "Your order payment is confirmed after secure server verification",
            "If payment fails or is cancelled, review your order status before retrying",
          ]}
        />
      </PolicySection>

      <PolicySection
        title={i18n("8. Shipping and Delivery")}
        intro="We work with trusted courier partners to deliver your orders safely and on time."
      >
        <PolicyList
          items={[
            "Estimated delivery timelines are shown at checkout and are subject to courier availability and your location",
            "Delivery times may be affected by weather, holidays, or other factors beyond our control",
            "It is your responsibility to provide an accurate, complete, and reachable delivery address",
            "Repeated failed delivery attempts due to incorrect information may result in additional charges or order cancellation",
            "Risk of loss or damage transfers to you once the order is delivered and accepted",
          ]}
        />
      </PolicySection>

      <PolicySection
        title={i18n("9. Returns and Refunds")}
        intro="Returns, exchanges, and refunds are governed by our Return Policy."
      >
        <p>
          {i18n("Please review the full")}{" "}
          <a href="/return-policy" className="font-semibold text-brand-red hover:underline">
            {i18n("Return Policy")}</a>{" "}
          {i18n("for eligibility, time limits, non-returnable items, and the refund process. By placing an order, you agree to those terms in addition to these Terms & Conditions.")}</p>
      </PolicySection>

      <PolicySection
        title={i18n("10. Reviews and User Content")}
        intro="You may submit reviews, ratings, and other content related to products."
      >
        <PolicyList
          items={[
            "Content must be honest, respectful, and based on your real experience",
            "Do not post offensive, defamatory, or unlawful content",
            "Do not include personal contact details, links, or promotional material in reviews",
            "By submitting content, you grant us a non-exclusive license to display, edit, and share it on the Site",
            "We may remove or edit content that violates these rules, at our discretion",
          ]}
        />
      </PolicySection>

      <PolicySection
        title={i18n("11. Intellectual Property")}
        intro="All content on the Site — including logos, designs, text, images, and software — is owned by or licensed to SexToy."
      >
        <p>
          {i18n("You may not copy, reproduce, distribute, or create derivative works from any part of the Site without our prior written permission, except for personal, non-commercial use as intended by the platform.")}</p>
      </PolicySection>

      <PolicySection
        title={i18n("12. Limitation of Liability")}
        intro="To the maximum extent permitted by law:"
      >
        <PolicyList
          items={[
            "SexToy is provided on an \"as is\" and \"as available\" basis",
            "We do not guarantee uninterrupted, error-free, or completely secure operation of the Site",
            "We are not liable for indirect, incidental, or consequential damages arising from your use of the Site",
            "Our total liability for any claim related to an order shall not exceed the amount paid for that order",
          ]}
        />
        <p>
          {i18n("Nothing in these terms excludes any liability that cannot be excluded under applicable law, including your statutory consumer rights.")}</p>
      </PolicySection>

      <PolicySection
        title={i18n("13. Privacy")}
        intro="Your use of SexToy is also governed by our Privacy Policy."
      >
        <p>
          {i18n("Please review our")}{" "}
          <a href="/privacy-policy" className="font-semibold text-brand-red hover:underline">
            {i18n("Privacy Policy")}</a>{" "}
          {i18n("to understand how we collect, use, and protect your information.")}</p>
      </PolicySection>

      <PolicySection
        title={i18n("14. Changes to These Terms")}
        intro="We may update these Terms & Conditions from time to time to reflect changes in our services, technology, or applicable laws."
      >
        <p>
          {i18n("When we make material changes, we will update the \"Last updated\" date at the top of this page. Your continued use of the Site after changes are posted constitutes acceptance of the updated terms.")}</p>
      </PolicySection>

      <PolicySection
        title={i18n("15. Governing Law")}
        intro="These Terms & Conditions are governed by the laws of the People's Republic of Bangladesh, without regard to its conflict-of-laws principles. Any disputes arising from these terms shall be subject to the jurisdiction of the competent courts located in Hong Kong, China"
      />

      <PolicySection
        title={i18n("16. Contact Information")}
        intro="If you have any questions about these Terms & Conditions, please reach out to us."
      >
        <div className="space-y-1">
          <p>
            <span className="font-semibold text-gray-900">{i18n("Company name:")}</span> {i18n("Xianhao Yida (Hong Kong) Limited")}</p>
        </div>
        <PolicyContactBlock />
      </PolicySection>
    </PolicyLayout>
  );
}
