import type { Metadata } from "next";

import ContactHero from "./components/ContactHero";
import ContactInfoCards from "./components/ContactInfoCards";
import ContactForm from "./components/ContactForm";
import FAQSection from "./components/FAQSection";
import { buildLocalizedMetadata } from "@/lib/seo/localized-metadata";
import { siteConfig } from "@/lib/seo/site";
import PreparedLanguageLinks from "@/components/i18n/PreparedLanguageLinks";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return buildLocalizedMetadata({
  title: "Contact Us",
  description: `Get in touch with ${siteConfig.name}. Questions about orders, products, or support? Reach our team and we'll help you out.`,
  path: "/contact",
  keywords: [`contact ${siteConfig.name}`, "customer support", "help", siteConfig.name],
}, "InterfaceContactPage");
}

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-brand-light-bg">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-10 sm:space-y-14">
        <ContactHero />
        <ContactInfoCards />
        <ContactForm />
        <FAQSection />
        <PreparedLanguageLinks pathname="/contact" />
      </div>
    </div>
  );
}
