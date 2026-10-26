
import { useInterfaceTranslations } from "@/components/i18n/translate";
import Image from "next/image";
import { PackageCheck, Target } from "lucide-react";

export default function OurStory() {
  const i18n = useInterfaceTranslations("InterfaceAboutComponentsOurStory");
  return (
    <section>
      <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
        {/* Image side */}
        <div className="relative">
          <div className="relative h-72 w-full overflow-hidden rounded-3xl bg-brand-black shadow-xl sm:h-80 lg:h-96">
            <Image
              src="/logo/wordmark.svg"
              alt={i18n("SexToy imported product story")}
              fill
              className="object-contain p-10"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />

            <div className="absolute inset-0 bg-gradient-to-br from-brand-black/70 via-brand-black/35 to-primary/30" />
          </div>

          {/* Floating badge */}
          <div className="absolute -bottom-5 -end-3 hidden rounded-2xl bg-card px-4 py-3 shadow-lg ring-1 ring-border sm:flex sm:items-center sm:gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
              <PackageCheck className="h-5 w-5" />
            </div>

            <div>
              <p className="text-xs text-muted-foreground">{i18n("Imported with")}</p>
              <p className="text-sm font-bold text-foreground">{i18n("Care & Quality")}</p>
            </div>
          </div>

                    <div className="absolute -start-4 -top-4 -z-10 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
          <div className="absolute -bottom-6 -end-2 -z-10 h-32 w-32 rounded-full bg-primary/10 blur-2xl sm:-end-3 lg:-end-6" />
        </div>

        {/* Text side */}
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5">
            <Target className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-bold uppercase tracking-wide text-primary">
              {i18n("Our Story")}</span>
          </div>

          <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
            {i18n.rich("Bringing <highlight>China-imported</highlight> products closer to you.", { highlight: (chunks) => <span className="text-primary">{chunks}</span> })}</h2>

          <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
            {i18n("SexToy was created with one clear goal: to make stylish, useful, and carefully selected China-imported products easier to buy online. We focus on sourcing products that match modern trends, practical needs, and customer expectations.")}</p>

          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            {i18n("From product selection to quality checking, every item is chosen with care so customers can shop with confidence. Our mission is to offer attractive imported collections, fair pricing, and a smooth e-commerce experience from browsing to delivery.")}</p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-muted p-4 ring-1 ring-border">
              <p className="text-2xl font-bold text-primary">CN</p>
              <p className="text-xs font-medium text-muted-foreground">
                {i18n("Imported Products")}</p>
            </div>

            <div className="rounded-2xl bg-muted p-4 ring-1 ring-border">
              <p className="text-2xl font-bold text-primary">QC</p>
              <p className="text-xs font-medium text-muted-foreground">
                {i18n("Quality Checked")}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
