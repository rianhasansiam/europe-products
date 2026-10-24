
import { useInterfaceTranslations } from "@/components/i18n/translate";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";

import PolicyHero from "@/components/policy/PolicyHero";
import RelatedPolicies from "@/components/policy/RelatedPolicies";

type PolicyLayoutProps = {
  eyebrow?: string;
  title: string;
  description: string;
  lastUpdated?: string;
  currentPath?: string;
  children: ReactNode;
};

export default function PolicyLayout({
  eyebrow = "Legal",
  title,
  description,
  lastUpdated,
  currentPath,
  children,
}: PolicyLayoutProps) {
  const i18n = useInterfaceTranslations("InterfacePolicyPolicyLayout");
  const locale = useLocale();
  const language = useTranslations("Language");
  return (
    <div className="min-h-screen bg-brand-light-bg">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-6 py-6 sm:py-10 space-y-8 sm:space-y-12">
        {locale !== "en" && (
          <p role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            {language("originalContent")}
          </p>
        )}
        <section lang="en" dir="ltr">
        <PolicyHero
          eyebrow={eyebrow}
          title={i18n(title)}
          description={i18n(description)}
          lastUpdated={lastUpdated}
        />

        <article className="mt-8 space-y-6 sm:space-y-8">{children}</article>
        </section>

        <RelatedPolicies currentPath={currentPath} />
      </div>
    </div>
  );
}
