
import { useInterfaceTranslations } from "@/components/i18n/translate";
import {

  Truck,
  Tag,
  Headphones,

  Sparkles,
} from "lucide-react";

const features = [

  {
    icon: Truck,
    title: "Fast Local Delivery",
    desc: "Get orders delivered same-day from stores within 50km of your location.",
    color: "bg-primary",
  },
  {
    icon: Tag,
    title: "Best Prices",
    desc: "Real-time deals and exclusive discounts you won't find anywhere else.",
    color: "bg-primary",
  },
  {
    icon: Headphones,
    title: "24/7 Support",
    desc: "Our friendly support team is always ready to help, day or night.",
    color: "bg-primary",
  },

];

export default function WhyChooseUs() {
  const i18n = useInterfaceTranslations("InterfaceAboutComponentsWhyChooseUs");
  return (
    <section>
      <div className="mb-6 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-[11px] font-bold uppercase tracking-wide text-primary">
            {i18n("Why Choose Us")}</span>
        </div>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
          {i18n.rich("Built for a <highlight>better shopping</highlight> experience.", { highlight: (chunks) => <span className="text-primary">{chunks}</span> })}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
          {i18n("We obsess over the details so you can shop with confidence, every single time.")}</p>
      </div>

      <div className="h-0.5 w-full bg-border rounded-full mb-6" />

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {features.map((f) => {
          const Icon = f.icon;
          return (
            <div
              key={f.title}
              className="group relative overflow-hidden rounded-2xl bg-card p-5 shadow-sm ring-1 ring-border transition-colors duration-200"
            >
              <div
                className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl ${f.color} text-white shadow-md transition-transform duration-300 `}
              >
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-foreground sm:text-lg">
                {i18n(f.title)}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {i18n(f.desc)}
              </p>

              {/* Hover accent */}
              <div className="absolute -end-8 -bottom-8 h-24 w-24 rounded-full bg-primary/10 opacity-0 transition-all duration-500 group-hover:opacity-100" />
            </div>
          );
        })}
      </div>
    </section>
  );
}
