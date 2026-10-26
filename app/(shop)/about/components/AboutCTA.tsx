
import { useInterfaceTranslations } from "@/components/i18n/translate";
import Link from "@/lib/i18n/navigation";
import { ChevronRight, Sparkles } from "lucide-react";

export default function AboutCTA() {
  const i18n = useInterfaceTranslations("InterfaceAboutComponentsAboutCTA");
  return (
    <section className="relative overflow-hidden rounded-3xl bg-secondary border border-border p-8 sm:p-10 lg:p-14 text-foreground shadow-sm">
      {/* Decorative elements */}
      <div className="absolute top-0 end-0 h-40 w-40 rounded-full bg-card/70 -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 start-0 h-56 w-56 rounded-full bg-white/5 translate-y-1/3 -translate-x-1/3" />

      <div className="relative z-10 mx-auto max-w-3xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-card/80 px-3 py-1.5 ring-1 ring-border">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-[11px] font-bold uppercase tracking-wide">
            {i18n("Ready to start?")}</span>
        </div>

        <h2 className="mt-4 text-2xl font-bold leading-tight tracking-tight sm:text-3xl lg:text-4xl">
          {i18n.rich("Discover deals from your <highlight>favorite local stores</highlight>", { highlight: (chunks) => <span className="text-primary">{chunks}</span> })}
        </h2>

        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-body sm:text-base">
          {i18n("Join thousands of shoppers enjoying premium products at unbeatable prices, delivered with love from your neighborhood.")}</p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/products"
            className="group inline-flex items-center gap-2 min-h-11 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md transition-colors duration-200 hover:bg-primary-hover"
          >
            {i18n("Browse Products")}<ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" />
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 min-h-11 rounded-xl bg-card/70 px-6 py-3 text-sm font-bold text-primary ring-1 ring-border transition-colors duration-200 hover:bg-card"
          >
            {i18n("Create Account")}</Link>
        </div>
      </div>
    </section>
  );
}
