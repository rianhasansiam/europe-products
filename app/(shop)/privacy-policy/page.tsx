
import type { Metadata } from "next";

import PolicyContactBlock from "@/components/policy/PolicyContactBlock";
import PolicyLayout from "@/components/policy/PolicyLayout";
import PolicyList from "@/components/policy/PolicyList";
import PolicySection from "@/components/policy/PolicySection";
import { buildLocalizedMetadata } from "@/lib/seo/localized-metadata";
import { siteConfig } from "@/lib/seo/site";

export const revalidate = 21600;

/**
 * Privacy Policy page.
 *
 * IMPORTANT: The legal text below is a professional starting template
 * tailored to the current SexToy feature set (credentials + Google login,
 * guest checkout, cart/wishlist via localStorage, Airwallex payments). It
 * should be reviewed by a qualified legal professional before being
 * used in production to ensure compliance with local data protection laws.
 */

export async function generateMetadata(): Promise<Metadata> {
  return buildLocalizedMetadata({
  title: "Privacy Policy",
  description: `Read how ${siteConfig.name} collects, uses, and protects your personal information when you shop, create an account, or checkout as a guest.`,
  path: "/privacy-policy",
  keywords: ["privacy policy", "data protection", "personal information", siteConfig.name],
}, "InterfacePrivacyPolicyPage");
}

const LAST_UPDATED = "2026-10-24";

export default function PrivacyPolicyPage() {
  // Contractual content stays in its original language until a reviewed translation is published.
  const i18n = (source: string) => source;
  return (
    <PolicyLayout
      title={i18n("Privacy Policy")}
      description={`At ${siteConfig.name}, your privacy matters. This policy explains what information we collect, how we use it, and the choices you have when shopping with us.`}
      lastUpdated={LAST_UPDATED}
      currentPath="/privacy-policy"
    >
      <PolicySection
        title={i18n("1. Introduction")}
        intro={`This Privacy Policy describes how ${siteConfig.name} ("we", "us", or "our") collects, uses, stores, and protects your information when you visit our website, create an account, place an order, or interact with our services. By using ${siteConfig.name}, you agree to the practices described in this policy.`}
      />

      <PolicySection
        title={i18n("2. Information We Collect")}
        intro="We collect information that helps us provide a smooth shopping experience and deliver your orders accurately."
      >
        <p className="font-semibold text-gray-900">{i18n("Information you provide directly:")}</p>
        <PolicyList
          items={[
            "Full name",
            "Email address",
            "Phone number",
            "Shipping and billing address",
            "Order details (products, quantities, preferences)",
            "Account information (username, hashed password, profile details)",
            "Messages you send through our contact form or customer support",
            "Product reviews and ratings you submit",
          ]}
        />

        <p className="font-semibold text-gray-900">{i18n("Information collected automatically:")}</p>
        <PolicyList
          items={[
            "Basic technical data such as browser type and device",
            "Pages viewed and products interacted with, to improve recommendations",
            "Cookies and similar technologies required for core site functionality",
          ]}
        />
      </PolicySection>

      <PolicySection
        title={i18n("3. How We Use Your Information")}
        intro="We use your information only for legitimate business purposes, including:"
      >
        <PolicyList
          items={[
            "Processing and confirming your orders",
            "Arranging delivery and coordinating with courier partners",
            "Providing customer support and responding to your inquiries",
            "Managing your account, login sessions, and order history",
            "Sending order-related notifications (confirmations, shipping updates)",
            "Improving our products, services, and overall shopping experience",
            "Preventing fraud, abuse, and unauthorized access to accounts",
            "Complying with applicable legal and regulatory obligations",
          ]}
        />
      </PolicySection>

      <PolicySection
        title={i18n("4. Authentication Information")}
        intro="We currently support two ways of signing in to your SexToy account:"
      >
        <PolicyList
          items={[
            <>
              <span className="font-semibold text-gray-900">{"Email & password (credentials login):"}</span>{" "}
              {"Your password is stored only in a securely hashed form. We never store or transmit passwords in plain text."}</>,
            <>
              <span className="font-semibold text-gray-900">{"Google login (OAuth):"}</span> {"When you choose to sign in with Google, we receive only the basic profile information you authorize, such as your name, email address, and profile picture. We do not receive your Google password."}</>,
          ]}
        />
        <p>
          {i18n("You may unlink or stop using either method at any time. Removing a sign-in method does not delete your account or order history.")}</p>
      </PolicySection>

      <PolicySection
        title={i18n("5. Guest Checkout")}
        intro="You may place orders without creating an account."
      >
        <p>
          {i18n("For guest checkout, we collect your name, email address, phone number, and shipping address so we can process your order and arrange delivery. This information is used strictly to fulfill your order, send order-related notifications, and provide customer support if needed.")}</p>
        <p>
          {i18n("Guest checkout data is not used to create a marketing profile, and you may contact us at any time to request deletion of guest order data, subject to legal and accounting retention requirements.")}</p>
      </PolicySection>

      <PolicySection
        title={i18n("6. Cart, Wishlist, and Local Storage")}
        intro="To make shopping faster and more convenient, we store some information directly in your browser."
      >
        <PolicyList
          items={[
            "Your shopping cart contents and quantities",
            "Items you add to your wishlist",
            "Recently viewed products and basic UI preferences",
            "Temporary session information needed to keep you signed in",
          ]}
        />
        <p>
          {i18n("This data lives in your browser's local storage and similar mechanisms on your own device. You can clear it at any time through your browser settings. Clearing this data will reset your cart and wishlist on that device.")}</p>
      </PolicySection>

      <PolicySection
        title={i18n("7. Data Security")}
        intro="We take reasonable technical and organizational measures to protect your information."
      >
        <PolicyList
          items={[
            "Passwords are stored using strong one-way hashing",
            "Transport is protected with HTTPS / TLS encryption",
            "Access to personal data is restricted to authorized personnel only",
            "Sensitive credentials and configuration are kept outside the public codebase",
          ]}
        />
        <p>
          {i18n("While we work hard to protect your data, no method of transmission or storage is 100% secure. We encourage you to use a strong, unique password and to keep your login credentials private.")}</p>
      </PolicySection>

      <PolicySection
        title={i18n("8. Third-Party Services")}
        intro="We rely on a small number of trusted third-party providers to operate our service."
      >
        <PolicyList
          items={[
            "Authentication providers (such as Google) for optional social sign-in",
            "Hosting and infrastructure providers that store our application data",
            "Delivery and courier partners that fulfill your orders",
            "Email delivery services for transactional notifications",
          ]}
        />
        <p>
          {i18n("These providers only receive the information they need to perform their service, and they are expected to handle that information in line with applicable laws. We do not sell your personal information to third parties.")}</p>
      </PolicySection>

      <PolicySection
        title={i18n("9. Your Rights")}
        intro="You have meaningful control over your personal information."
      >
        <PolicyList
          items={[
            "Access the information we hold about you",
            "Correct or update inaccurate account or order details",
            "Request deletion of your account and associated personal data",
            "Opt out of non-essential marketing communications",
            "Withdraw consent for optional data uses at any time",
          ]}
        />
        <p>
          {i18n("To exercise any of these rights, please contact us using the details below. We may need to verify your identity before completing certain requests, and some information may be retained where required by law (for example, tax and order records).")}</p>
      </PolicySection>

      <PolicySection
        title={i18n("10. Children's Privacy")}
        intro="SexToy is not directed to children under the age of 13."
      >
        <p>
          {i18n("We do not knowingly collect personal information from children. If you believe a child has provided us with personal information, please contact us and we will take appropriate steps to remove it.")}</p>
      </PolicySection>

      <PolicySection
        title={i18n("11. Changes to This Policy")}
        intro="We may update this Privacy Policy from time to time."
      >
        <p>
          {i18n("When we make material changes, we will update the \"Last updated\" date at the top of this page and, where appropriate, provide additional notice. Please review this page periodically to stay informed.")}</p>
      </PolicySection>

      <PolicySection
        title={i18n("12. Contact Us")}
        intro="If you have any questions about this Privacy Policy or how we handle your information, please get in touch."
      >
        <PolicyContactBlock />
      </PolicySection>
    </PolicyLayout>
  );
}
