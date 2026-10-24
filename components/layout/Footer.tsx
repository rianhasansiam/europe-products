
import { useInterfaceTranslations } from "@/components/i18n/translate";
import Link from "@/lib/i18n/navigation";

import { siteConfig } from "@/lib/seo/site";

const quickLinks = [
  { name: "Home", href: "/" },
  { name: "Shop Categories", href: "/categories" },
  { name: "All Products", href: "/products" },
  { name: "Brands", href: "/brands" },
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
    <footer className="bg-brand-black text-brand-white ">
      <div className="container mx-auto px-4 py-8 sm:py-10">
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Brand Section */}
          <div className="col-span-2 sm:col-span-2 md:col-span-1 space-y-3 sm:space-y-4 ">
            <Link
              href="/"
              aria-label={i18n("{value0} - Good Quality. Good Service. - home", { value0: siteConfig.name })}
              className="items-center  group inline-flex flex-col rounded-xl py-1 pe-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2 focus-visible:ring-offset-brand-black"
            >
              <span className="mb-2 whitespace-nowrap text-3xl font-black leading-none tracking-[-0.06em] text-brand-white sm:text-4xl">
                {"Sex"}<span className="text-brand-red">{"Toy"}</span>
              </span>
              <span className="mt-1.5 whitespace-nowrap text-[0.52rem] font-bold uppercase leading-none tracking-[0.22em] text-brand-white/55 transition-colors duration-300 group-hover:text-brand-white/80">
                {i18n("- Good Quality. Good Service. -")}</span>
            </Link>
            <p className="text-brand-white text-xs sm:text-sm leading-relaxed">
              {i18n("Discover carefully selected products, current offers, and a smooth online shopping experience.")}</p>
          </div>

          {/* Quick Links */}
          <div>
            <h2 className="text-base sm:text-lg font-black text-brand-white mb-3 sm:mb-4">
              {i18n("Quick Links")}</h2>
            <ul className="space-y-1.5 sm:space-y-2">
              {quickLinks.map((link, i) => (
                <li key={i}>
                  <Link
                    href={link.href}
                    className="text-brand-white hover:text-brand-red focus-visible:text-brand-red transition text-xs sm:text-sm"
                  >
                    {i18n(link.name)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support Center */}
          <div>
            <h2 className="text-base sm:text-lg font-black text-brand-white mb-3 sm:mb-4">
              {i18n("Support Center")}</h2>
            <ul className="space-y-1.5 sm:space-y-2">
              {supportLinks.map((link, i) => (
                <li key={i}>
                  <Link
                    href={link.href}
                    className="text-brand-white hover:text-brand-red focus-visible:text-brand-red transition text-xs sm:text-sm"
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
