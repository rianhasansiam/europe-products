
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
    <div className="group relative order-first flex min-h-32 min-w-0 w-full shrink-0 flex-col justify-center overflow-hidden rounded-2xl bg-brand-black p-4 text-brand-white shadow-lg transition-all duration-300 hover:shadow-xl lg:order-none lg:w-52">
      <Image
        src={saleBanner.image}
        alt={i18n(saleBanner.heading)}
        fill
        sizes="(min-width: 1024px) 208px, (min-width: 640px) calc(100vw - 32px), calc(100vw - 24px)"
        className="object-cover opacity-80 transition-all duration-500 group-hover:scale-110 group-hover:opacity-50"
      />
      <div className="absolute end-0 top-0 h-24 w-24 -translate-y-1/2 translate-x-1/2 rounded-full bg-brand-white/10" />
      <div className="absolute bottom-0 start-0 h-32 w-32 -translate-x-1/2 translate-y-1/2 rounded-full bg-brand-white/5" />

      <div className="relative z-10">
        <div className="mb-3 inline-block max-w-full rounded-full bg-brand-red px-2.5 py-1 text-[10px] font-bold text-brand-white shadow-md [overflow-wrap:anywhere]">
          {i18n(saleBanner.label)}
        </div>
        <h3 className="mb-1 text-2xl font-black leading-tight tracking-tight [overflow-wrap:anywhere]">
          {i18n(saleBanner.heading)}
        </h3>
        <div className="mb-2 text-4xl font-black text-brand-gold drop-shadow-lg [overflow-wrap:anywhere]">
          {saleBanner.discount}
        </div>
        <p className="mb-4 text-[11px] leading-relaxed opacity-90 [overflow-wrap:anywhere]">
          {i18n(saleBanner.description)}
        </p>
        <Link
          href={saleBanner.link}
          className="block w-[40%]  rounded-full bg-brand-white px-4 py-2 text-center text-xs font-bold text-brand-black shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-brand-red hover:text-brand-white hover:shadow-lg  sm:w-[60%] md:w-[70%] lg:w-[80%]"
        >
          {i18n("Shop now →")}</Link>
      </div>
    </div>
  );
}
