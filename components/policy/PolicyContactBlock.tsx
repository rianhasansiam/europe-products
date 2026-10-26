
import { siteConfig } from "@/lib/seo/site";

/**
 * Highlighted customer-support contact callout shared across policy pages
 * (Privacy, Return, Terms). Renders the standard SexToy support email,
 * inside a support card.
 */
export default function PolicyContactBlock() {
  const i18n = (source: string) => source;
  return (
    <div className="rounded-2xl bg-secondary p-4 ring-1 ring-border sm:p-5">
      <p className="text-sm font-bold text-foreground sm:text-base">{siteConfig.name} {i18n("Customer Support")}</p>
      <ul className="mt-2 space-y-1 text-base text-body">
        <li>
          <span className="font-semibold text-foreground">{i18n("Email:")}</span>{" "}
          <a
            href={`mailto:${siteConfig.contact.email}`}
            className="text-primary hover:text-primary-hover hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {siteConfig.contact.email}
          </a>
        </li>
      </ul>
    </div>
  );
}
