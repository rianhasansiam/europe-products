
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
 * Matches the storefront card surface, border, and heading typography.
 */
export default function PolicySection({ title, intro, children }: PolicySectionProps) {
  const i18n = useInterfaceTranslations("InterfacePolicyPolicySection");
  return (
    <section className="rounded-2xl bg-card p-5 shadow-sm ring-1 ring-border sm:p-7">
      <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">{i18n(title)}</h2>
      {intro && (
        <p className="mt-2 text-base leading-7 text-body">{i18n(intro)}</p>
      )}
      {children && (
        <div className="mt-3 space-y-3 text-base leading-7 text-body">
          {children}
        </div>
      )}
    </section>
  );
}
