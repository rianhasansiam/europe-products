import { useTranslations } from "next-intl";
import Link from "@/lib/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("States");
  return <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
    <p className="text-sm font-semibold text-muted-foreground">404</p>
    <h1 className="text-3xl font-bold">{t("notFoundTitle")}</h1>
    <p className="text-muted-foreground">{t("notFoundDescription")}</p>
    <Link href="/" className="rounded-xl bg-primary px-5 py-3 font-semibold transition-colors hover:bg-primary-hover text-primary-foreground">{t("home")}</Link>
  </main>;
}
