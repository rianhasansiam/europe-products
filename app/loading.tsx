import { LoadingPage } from "@/components/ui/loading";
import { useTranslations } from "next-intl";

export default function Loading() {
  const t = useTranslations("Loading");
  return (
    <LoadingPage
      title={t("title")}
      message={t("description")}
    />
  );
}
