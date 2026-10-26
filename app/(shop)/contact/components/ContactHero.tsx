
import { useInterfaceTranslations } from "@/components/i18n/translate";
import { Sparkles, MessageCircle } from "lucide-react";

import { siteConfig } from "@/lib/seo/site";

export default function ContactHero() {
  const i18n = useInterfaceTranslations("InterfaceContactComponentsContactHero");
  return (
    <section className="relative overflow-hidden rounded-3xl bg-secondary border border-border px-6 py-12 sm:px-10 sm:py-16 lg:px-14 lg:py-20 text-foreground shadow-sm">

      <div className="relative z-10 grid items-center gap-8 lg:grid-cols-2">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-card/80 px-3 py-1.5 ring-1 ring-border">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-bold tracking-wide uppercase">
              {i18n("Get in Touch")}</span>
          </div>

          <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            {i18n.rich("We'd love to <highlight>hear from you.</highlight>", { highlight: (chunks) => <span className="block text-primary">{chunks}</span> })}
          </h1>

          <p className="mt-4 max-w-xl text-sm leading-relaxed text-body sm:text-base">
            {i18n("Questions, feedback, or partnership ideas? Our team typically replies within a few hours, seven days a week.")}</p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a
              href="#contact-form"
              className="group inline-flex items-center gap-2 min-h-11 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-colors duration-200 hover:bg-primary-hover"
            >
              <MessageCircle className="h-4 w-4" />
              {i18n("Send Message")}</a>

          </div>
        </div>

        {/* Right floating card */}
        <div className="relative hidden lg:flex justify-center">
          <div className="relative w-full max-w-sm rounded-3xl bg-card/80 p-6 ring-1 ring-border shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card text-primary shadow-lg">
                <MessageCircle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-bold">{siteConfig.name} {i18n("Support")}</p>
                <p className="text-xs text-body">{i18n("Avg. reply in under 2 hours")}</p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              {[
                { k: "24/7", v: "Live Chat" },
                { k: "<2hr", v: "Email Reply" },
                { k: "98%", v: "Resolution" },
                { k: "4.9★", v: "Support Rating" },
              ].map((item) => (
                <div
                  key={i18n(item.v)}
                  className="rounded-xl bg-card/70 px-3 py-2.5 ring-1 ring-border"
                >
                  <p className="text-lg font-bold text-primary">{item.k}</p>
                  <p className="text-[11px] uppercase tracking-wide text-body">
                    {i18n(item.v)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
