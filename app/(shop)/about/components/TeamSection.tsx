
import { useInterfaceTranslations } from "@/components/i18n/translate";
import Image from "next/image";
import { Users } from "lucide-react";

const team = [
  {
    name: "Rian Hasan Siam",
    role: "Founder & CTO",
    image: "/images/RianDp.png",
  },
  {
    name: "Md Nafiz Islam Nayan",
    role: "Co-Founder & CEO",
    image:
      "/images/nayan.jpg",
  }
];

export default function TeamSection() {
  const i18n = useInterfaceTranslations("InterfaceAboutComponentsTeamSection");
  return (
    <section>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5">
            <Users className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-bold uppercase tracking-wide text-primary">
              {i18n("Meet The Team")}</span>
          </div>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
            {i18n("People behind SexToy")}</h2>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            {i18n("A passionate team obsessed with making local shopping feel effortless.")}</p>
        </div>
      </div>

      <div className="h-0.5 w-full bg-border rounded-full mb-8" />

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-5">
        {team.map((member) => (
          <div
            key={member.name}
            className="group relative flex flex-col items-center rounded-3xl border border-border bg-card px-6 py-8 text-center transition-colors duration-200.5 hover:border-primary/40 hover:shadow-primary/10"
          >
            {/* Portrait */}
            <div className="relative">
              <div className="rounded-full bg-primary p-1 transition-transform duration-300 group-hover:scale-105">
                <div className="rounded-full bg-card p-1">
                  <div className="relative h-28 w-28 overflow-hidden rounded-full sm:h-32 sm:w-32">
                    <Image
                      src={member.image}
                      alt={member.name}
                      fill
                      sizes="(max-width: 640px) 50vw, 33vw"
                      className="object-cover transition-transform duration-500 "
                    />
                  </div>
                </div>
              </div>
            </div>

            <h3 className="mt-5 text-lg font-bold text-foreground">
              {member.name}
            </h3>
            <span className="mt-2 inline-flex rounded-full bg-muted px-3 py-1 text-xs font-semibold text-primary">
              {i18n(member.role)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
