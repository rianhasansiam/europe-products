import type { Metadata } from "next";

import AboutHero from "./components/AboutHero";
import OurStory from "./components/OurStory";
import WhyChooseUs from "./components/WhyChooseUs";
import OurValues from "./components/OurValues";
import Testimonials from "./components/Testimonials";
import AboutCTA from "./components/AboutCTA";

import { getActiveTestimonials } from "@/lib/services/testimonial.service";
import { buildLocalizedMetadata } from "@/lib/seo/localized-metadata";
import { siteConfig } from "@/lib/seo/site";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return buildLocalizedMetadata({
  title: "About Us",
  description: `Learn about ${siteConfig.name} — our story, values, and the team behind your trusted online shopping destination for quality products at great prices.`,
  path: "/about",
  keywords: [`about ${siteConfig.name}`, "our story", "company", siteConfig.name],
}, "InterfaceAboutPage");
}

export default async function AboutPage() {
  const testimonials = await getActiveTestimonials();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-10 sm:space-y-14">
        <AboutHero />
        <OurStory />
        <WhyChooseUs />
        <OurValues />
        {/* <TeamSection /> */}
        <Testimonials testimonials={testimonials} />
        <AboutCTA />
      </div>
    </div>
  );
}
