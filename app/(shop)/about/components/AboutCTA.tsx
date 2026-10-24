
import { useInterfaceTranslations } from "@/components/i18n/translate";
import Link from "@/lib/i18n/navigation";
import { ChevronRight, Sparkles } from "lucide-react";

export default function AboutCTA() {
  const i18n = useInterfaceTranslations("InterfaceAboutComponentsAboutCTA");
  return (
    <section className="relative overflow-hidden rounded-3xl bg-brand-black p-8 sm:p-10 lg:p-14 text-white shadow-xl">
      {/* Decorative elements */}
      <div className="absolute top-0 end-0 h-40 w-40 rounded-full bg-white/10 -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 start-0 h-56 w-56 rounded-full bg-white/5 translate-y-1/3 -translate-x-1/3" />
      <div className="absolute top-10 end-20 hidden h-20 w-20 rounded-full bg-brand-red/20 blur-xl sm:block" />

      <div className="relative z-10 mx-auto max-w-3xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 backdrop-blur-sm ring-1 ring-white/20">
          <Sparkles className="h-3.5 w-3.5 text-brand-gold" />
          <span className="text-[11px] font-bold uppercase tracking-wide">
            {i18n("Ready to start?")}</span>
        </div>

        <h2 className="mt-4 text-2xl font-black leading-tight tracking-tight sm:text-3xl lg:text-4xl">
          {i18n.rich("Discover deals from your <highlight>favorite local stores</highlight>", { highlight: (chunks) => <span className="text-brand-red drop-shadow-md">{chunks}</span> })}
        </h2>

        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/90 sm:text-base">
          {i18n("Join thousands of shoppers enjoying premium products at unbeatable prices, delivered with love from your neighborhood.")}</p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/products"
            className="group inline-flex items-center gap-2 rounded-full bg-brand-red px-6 py-3 text-sm font-bold text-brand-white shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-brand-red-hover hover:shadow-lg"
          >
            {i18n("Browse Products")}<ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" />
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-full bg-white/10 px-6 py-3 text-sm font-bold text-white ring-1 ring-white/30 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/20"
          >
            {i18n("Create Account")}</Link>
        </div>
      </div>
    </section>
  );
}
