
import { useInterfaceTranslations } from "@/components/i18n/translate";
import Link from "@/lib/i18n/navigation";
import { ChevronRight, Sparkles, PackageCheck } from "lucide-react";

export default function AboutHero() {
  const i18n = useInterfaceTranslations("InterfaceAboutComponentsAboutHero");
  return (
    <section className="relative overflow-hidden rounded-3xl bg-brand-black px-6 py-12 text-white shadow-xl sm:px-10 sm:py-16 lg:px-14 lg:py-20">
      {/* Decorative blobs */}
      <div className="absolute -end-20 -top-20 h-60 w-60 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute -bottom-24 -start-24 h-72 w-72 rounded-full bg-brand-red/20 blur-3xl" />
      <div className="absolute end-10 top-10 hidden h-24 w-24 rounded-full bg-brand-red/20 blur-xl sm:block" />

      <div className="relative z-10 grid items-center gap-8 lg:grid-cols-2">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 backdrop-blur-sm ring-1 ring-white/20">
            <Sparkles className="h-3.5 w-3.5 text-brand-gold" />
            <span className="text-[11px] font-bold uppercase tracking-wide">
              {i18n("About SexToy")}</span>
          </div>

          <h1 className="mt-4 text-3xl font-black leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            {i18n.rich("Curated China-Imported <highlight>Products for Modern Buyers.</highlight>", { highlight: (chunks) => <span className="block text-brand-red drop-shadow-md">{chunks}</span> })}
          </h1>

          <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/90 sm:text-base">
            {i18n("SexToy brings carefully selected China-imported products to your doorstep with a focus on quality, trendy collections, fair pricing, and a smooth online shopping experience.")}</p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/products"
              className="group inline-flex items-center gap-2 rounded-full bg-brand-red px-5 py-2.5 text-sm font-bold text-brand-white shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-brand-red-hover hover:shadow-lg"
            >
              {i18n("Explore Products")}<ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" />
            </Link>

            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 text-sm font-bold text-white ring-1 ring-white/30 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/20"
            >
              {i18n("Contact Us")}</Link>
          </div>
        </div>

        {/* Right floating card */}
        <div className="relative hidden justify-center lg:flex">
          <div className="relative w-full max-w-sm rounded-3xl bg-white/15 p-6 shadow-2xl backdrop-blur-md ring-1 ring-white/20">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-white text-brand-red shadow-lg">
                <PackageCheck className="h-6 w-6" />
              </div>

              <div>
                <p className="text-sm font-bold">{i18n("SexToy Imported Collection")}</p>
                <p className="text-xs text-white/80">
                  {i18n("Trendy products selected with care")}</p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              {[
                { k: "CN", v: "China Imported" },
                { k: "QC", v: "Quality Checked" },
                { k: "New", v: "Trending Items" },
                { k: "Fast", v: "Smooth Delivery" },
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
