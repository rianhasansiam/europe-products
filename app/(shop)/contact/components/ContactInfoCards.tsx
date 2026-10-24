
import { useInterfaceTranslations } from "@/components/i18n/translate";
import { Building2, Mail } from "lucide-react";

import { siteConfig } from "@/lib/seo/site";

const cards = [
  {
    icon: Mail,
    title: "Email Us",
    value: siteConfig.contact.email,
    helper: "We reply within 2 hours",
    href: `mailto:${siteConfig.contact.email}`,
    color: "bg-brand-red",
  },
  {
    icon: Building2,
    title: "Company Info",
    value: siteConfig.contact.companyName,
    helper: "",
    color: "bg-brand-red",
  },
];

export default function ContactInfoCards() {
  const i18n = useInterfaceTranslations("InterfaceContactComponentsContactInfoCards");
  return (
    <section>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.title}
              className="group relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-brand-border transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
            >
              <div
                className={`mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl ${c.color} text-white shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}
              >
                <Icon className="h-6 w-6" />
              </div>
              <p className="text-xs font-bold uppercase tracking-wide text-brand-red">
                {i18n(c.title)}
              </p>
              <p className="mt-1 text-base font-black text-foreground sm:text-lg">
                {"href" in c ? <a href={c.href} className="hover:underline">{c.value}</a> : c.value}
              </p>
              {c.helper && <p className="mt-0.5 text-xs text-muted-foreground">{i18n(c.helper)}</p>}

              {/* Decorative corner */}
              <div className="absolute -end-6 -top-6 h-16 w-16 rounded-full bg-brand-red/10 transition-transform duration-500 group-hover:scale-150" />
            </div>
          );
        })}
      </div>
    </section>
  );
}
