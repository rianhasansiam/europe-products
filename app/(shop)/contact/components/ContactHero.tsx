
import { useInterfaceTranslations } from "@/components/i18n/translate";
import { Sparkles, MessageCircle } from "lucide-react";

import { siteConfig } from "@/lib/seo/site";

export default function ContactHero() {
  const i18n = useInterfaceTranslations("InterfaceContactComponentsContactHero");
  return (
    <section className="relative overflow-hidden rounded-3xl bg-brand-black px-6 py-12 sm:px-10 sm:py-16 lg:px-14 lg:py-20 text-white shadow-xl">
      {/* Decorative blobs */}
      <div className="absolute -top-20 -end-20 h-60 w-60 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute -bottom-24 -start-24 h-72 w-72 rounded-full bg-brand-red/20 blur-3xl" />
      <div className="absolute top-10 end-10 hidden h-24 w-24 rounded-full bg-brand-red/20 blur-xl sm:block" />

      <div className="relative z-10 grid items-center gap-8 lg:grid-cols-2">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 backdrop-blur-sm ring-1 ring-white/20">
            <Sparkles className="h-3.5 w-3.5 text-brand-gold" />
            <span className="text-[11px] font-bold tracking-wide uppercase">
              {i18n("Get in Touch")}</span>
          </div>

          <h1 className="mt-4 text-3xl font-black leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            {i18n.rich("We'd love to <highlight>hear from you.</highlight>", { highlight: (chunks) => <span className="block text-brand-red drop-shadow-md">{chunks}</span> })}
          </h1>

          <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/90 sm:text-base">
            {i18n("Questions, feedback, or partnership ideas? Our team typically replies within a few hours, seven days a week.")}</p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a
              href="#contact-form"
              className="group inline-flex items-center gap-2 rounded-full bg-brand-red px-5 py-2.5 text-sm font-bold text-brand-white shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-brand-red-hover hover:shadow-lg"
            >
              <MessageCircle className="h-4 w-4" />
              {i18n("Send Message")}</a>

          </div>
        </div>

        {/* Right floating card */}
        <div className="relative hidden lg:flex justify-center">
          <div className="relative w-full max-w-sm rounded-3xl bg-white/15 p-6 backdrop-blur-md ring-1 ring-white/20 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-white text-brand-red shadow-lg">
                <MessageCircle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-bold">{siteConfig.name} {i18n("Support")}</p>
                <p className="text-xs text-white/80">{i18n("Avg. reply in under 2 hours")}</p>
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
                  className="rounded-xl bg-white/10 px-3 py-2.5 ring-1 ring-white/15"
                >
                  <p className="text-lg font-black text-brand-gold">{item.k}</p>
                  <p className="text-[11px] uppercase tracking-wide text-white/80">
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
