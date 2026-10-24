
import { useInterfaceTranslations } from "@/components/i18n/translate";
import React from "react";

type PolicySectionProps = {
  /** Section heading, e.g. "1. Information We Collect". */
  title: string;
  /** Optional short intro paragraph rendered under the heading. */
  intro?: string;
  children?: React.ReactNode;
};

/**
 * Card-styled section block used inside policy pages.
 * Matches the storefront design system (rounded-3xl card, violet ring,
 * `font-black` heading).
 */
export default function PolicySection({ title, intro, children }: PolicySectionProps) {
  const i18n = useInterfaceTranslations("InterfacePolicyPolicySection");
  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-brand-border sm:p-7">
      <h2 className="text-lg font-black tracking-tight text-gray-900 sm:text-xl">{i18n(title)}</h2>
      {intro && (
        <p className="mt-2 text-sm leading-relaxed text-gray-600 sm:text-base">{i18n(intro)}</p>
      )}
      {children && (
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-gray-700 sm:text-base">
          {children}
        </div>
      )}
    </section>
  );
}
