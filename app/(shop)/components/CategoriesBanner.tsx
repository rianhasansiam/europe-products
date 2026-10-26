
import { useInterfaceTranslations } from "@/components/i18n/translate";
import Image from "next/image";
import Link from "@/lib/i18n/navigation";

type SaleBanner = {
  image: string;
  label: string;
  heading: string;
  discount: string;
  description: string;
  link: string;
};

export function CategoriesBanner({ saleBanner }: { saleBanner: SaleBanner }) {
  const i18n = useInterfaceTranslations("InterfaceComponentsCategoriesBanner");
  return (
    <div className="relative order-first flex min-h-32 min-w-0 w-full shrink-0 flex-col justify-center overflow-hidden rounded-2xl bg-primary p-5 text-primary-foreground lg:order-none lg:w-52">
      <Image
        src={saleBanner.image}
        alt={i18n(saleBanner.heading)}
        fill
        sizes="(min-width: 1024px) 208px, (min-width: 640px) calc(100vw - 32px), calc(100vw - 24px)"
        className="object-cover opacity-15"
      />

      <div className="relative z-10">
        <div className="mb-3 inline-block max-w-full rounded-full bg-card px-2.5 py-1 text-[11px] font-semibold text-primary [overflow-wrap:anywhere]">
          {i18n(saleBanner.label)}
        </div>
        <h3 className="mb-2 text-2xl font-bold leading-tight tracking-tight [overflow-wrap:anywhere]">
          {i18n(saleBanner.heading)}
        </h3>
        <div className="mb-3 text-4xl font-bold [overflow-wrap:anywhere]">
          {saleBanner.discount}
        </div>
        <p className="mb-5 text-sm leading-relaxed [overflow-wrap:anywhere]">
          {i18n(saleBanner.description)}
        </p>
        <Link
          href={saleBanner.link}
          className="inline-flex min-h-11 max-w-full items-center justify-center rounded-xl bg-card px-4 py-2 text-center text-sm font-semibold text-primary transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
        >
          {i18n("Shop now →")}</Link>
      </div>
    </div>
  );
}
