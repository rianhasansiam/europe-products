
import { useInterfaceTranslations } from "@/components/i18n/translate";
import Link from "@/lib/i18n/navigation";
import { ChevronRight, Sparkles, PackageCheck } from "lucide-react";

export default function AboutHero() {
  const i18n = useInterfaceTranslations("InterfaceAboutComponentsAboutHero");
  return (
    <section className="relative overflow-hidden rounded-3xl bg-secondary border border-border px-6 py-12 text-foreground shadow-sm sm:px-10 sm:py-16 lg:px-14 lg:py-20">

      <div className="relative z-10 grid items-center gap-8 lg:grid-cols-2">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-card/80 px-3 py-1.5 ring-1 ring-border">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-bold uppercase tracking-wide">
              {i18n("About SexToy")}</span>
          </div>

          <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            {i18n.rich("Curated China-Imported <highlight>Products for Modern Buyers.</highlight>", { highlight: (chunks) => <span className="block text-primary">{chunks}</span> })}
          </h1>

          <p className="mt-4 max-w-xl text-sm leading-relaxed text-body sm:text-base">
            {i18n("SexToy brings carefully selected China-imported products to your doorstep with a focus on quality, trendy collections, fair pricing, and a smooth online shopping experience.")}</p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/products"
              className="group inline-flex items-center gap-2 min-h-11 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-colors duration-200 hover:bg-primary-hover"
            >
              {i18n("Explore Products")}<ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" />
            </Link>

            <Link
              href="/contact"
              className="inline-flex items-center gap-2 min-h-11 rounded-xl bg-card/70 px-5 py-2.5 text-sm font-bold text-primary ring-1 ring-border transition-colors duration-200 hover:bg-card"
            >
              {i18n("Contact Us")}</Link>
          </div>
        </div>

        {/* Right floating card */}
        <div className="relative hidden justify-center lg:flex">
          <div className="relative w-full max-w-sm rounded-3xl bg-card/80 p-6 shadow-sm ring-1 ring-border">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card text-primary shadow-lg">
                <PackageCheck className="h-6 w-6" />
              </div>

              <div>
                <p className="text-sm font-bold">{i18n("SexToy Imported Collection")}</p>
                <p className="text-xs text-body">
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
