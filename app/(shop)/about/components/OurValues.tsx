
import { useInterfaceTranslations } from "@/components/i18n/translate";
import { Heart, Lightbulb, Users, Leaf } from "lucide-react";

const values = [
  {
    icon: Heart,
    title: "Customer First",
    desc: "Every decision starts with what's best for our shoppers and partners.",
  },
  {
    icon: Lightbulb,
    title: "Always Innovating",
    desc: "We constantly improve to deliver smoother, smarter shopping.",
  },
  {
    icon: Users,
    title: "Community Driven",
    desc: "We grow stronger by uplifting local merchants and neighborhoods.",
  },
  {
    icon: Leaf,
    title: "Mindful Impact",
    desc: "Sustainable, responsible commerce that respects people and planet.",
  },
];

export default function OurValues() {
  const i18n = useInterfaceTranslations("InterfaceAboutComponentsOurValues");
  return (
    <section className="rounded-3xl bg-brand-light-bg p-6 sm:p-8 lg:p-10 ring-1 ring-brand-border">
      <div className="mb-6 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 ring-1 ring-brand-border shadow-sm">
          <Heart className="h-3.5 w-3.5 text-brand-red" />
          <span className="text-[11px] font-bold uppercase tracking-wide text-brand-red">
            {i18n("Our Values")}</span>
        </div>
        <h2 className="mt-3 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
          {i18n("What we stand for")}</h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        {values.map((v) => {
          const Icon = v.icon;
          return (
            <div
              key={v.title}
              className="group rounded-2xl bg-white/70 p-5 backdrop-blur-sm ring-1 ring-brand-border transition-all duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-md"
            >
              <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-red text-white shadow-md transition-transform duration-300 group-hover:scale-110">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-foreground">{i18n(v.title)}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {i18n(v.desc)}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
