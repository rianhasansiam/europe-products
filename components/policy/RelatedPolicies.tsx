
import { useInterfaceTranslations } from "@/components/i18n/translate";
import Link from "@/lib/i18n/navigation";

type RelatedPoliciesProps = {
  /** Path of the page currently being rendered, so it can be excluded from the list. */
  currentPath?: string;
};

const LINKS = [
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/return-policy", label: "Return Policy" },
  { href: "/terms-and-conditions", label: "Terms & Conditions" },
  { href: "/contact", label: "Contact Us" },
];

/**
 * Footer navigation card linking to the other customer-facing policies.
 * Shown at the bottom of every policy page; the current page is filtered
 * out when `currentPath` is provided.
 */
export default function RelatedPolicies({ currentPath }: RelatedPoliciesProps) {
  const i18n = useInterfaceTranslations("InterfacePolicyRelatedPolicies");
  const links = currentPath ? LINKS.filter((l) => l.href !== currentPath) : LINKS;

  return (
    <nav
      aria-label={i18n("Related policies")}
      className="rounded-2xl bg-secondary p-5 ring-1 ring-border sm:p-6"
    >
      <h2 className="text-base font-semibold text-foreground sm:text-lg">{i18n("Related policies")}</h2>
      <p className="mt-1 text-xs text-body sm:text-sm">
        {i18n("Please also review our other customer policies.")}</p>
      <ul className="mt-4 flex flex-wrap gap-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="inline-flex min-h-11 items-center rounded-xl bg-card px-4 py-2 text-sm font-semibold text-primary ring-1 ring-border transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {i18n(link.label)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
