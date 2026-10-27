
import { useInterfaceTranslations } from "@/components/i18n/translate";
import Link from "@/lib/i18n/navigation";

import { siteConfig } from "@/lib/seo/site";

const quickLinks = [
  { name: "Home", href: "/" },
  { name: "Shop Categories", href: "/categories" },
  { name: "All Products", href: "/products" },
  { name: "About Us", href: "/about" },
];

const supportLinks = [
  { name: "Any Help", href: "/contact" },
  { name: "Terms & Conditions", href: "/terms-and-conditions" },
  { name: "Privacy Policy", href: "/privacy-policy" },
  { name: "Return Policy", href: "/return-policy" },
  { name: "FAQS", href: "/contact" },
];

const Footer = () => {
  const i18n = useInterfaceTranslations("InterfaceLayoutFooter");
  return (
    <footer className="border-t border-border bg-secondary text-body">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-6 sm:py-14">
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-3 lg:gap-16">
          {/* Brand Section */}
          <div className="col-span-2 space-y-4 md:col-span-1">
            <Link
              href="/"
              aria-label={i18n("{value0} - Good Quality. Good Service. - home", { value0: siteConfig.name })}
              className="group inline-flex flex-col items-center rounded-xl py-1 pe-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-secondary"
            >
              <span className="mb-2 whitespace-nowrap text-3xl font-bold leading-none tracking-[-0.06em] text-foreground sm:text-4xl">
                {"Sex"}<span className="text-primary">{"Toy"}</span>
              </span>
              <span className="mt-1.5 whitespace-nowrap text-[0.52rem] font-bold uppercase leading-none tracking-[0.22em] text-body">
                {i18n("- Good Quality. Good Service. -")}</span>
            </Link>
            <p className="max-w-sm text-sm leading-7 text-body">
              {i18n("Discover carefully selected products, current offers, and a smooth online shopping experience.")}</p>
          </div>

          {/* Quick Links */}
          <div>
            <h2 className="mb-3 text-base font-semibold text-foreground sm:mb-4">
              {i18n("Quick Links")}</h2>
            <ul className="space-y-1">
              {quickLinks.map((link, i) => (
                <li key={i}>
                  <Link
                    href={link.href}
                    className="inline-flex min-h-11 items-center rounded-md py-1 text-sm text-body transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                  >
                    {i18n(link.name)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support Center */}
          <div>
            <h2 className="mb-3 text-base font-semibold text-foreground sm:mb-4">
              {i18n("Support Center")}</h2>
            <ul className="space-y-1">
              {supportLinks.map((link, i) => (
                <li key={i}>
                  <Link
                    href={link.href}
                    className="inline-flex min-h-11 items-center rounded-md py-1 text-sm text-body transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                  >
                    {i18n(link.name)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>


        </div>
      </div>
    </footer>
  );
};

export default Footer;
