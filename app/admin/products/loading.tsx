
import { useInterfaceTranslations } from "@/components/i18n/translate";
import { AdminTablePageSkeleton } from "@/components/ui/loading";

export default function Loading() {
  const i18n = useInterfaceTranslations("AdminAdminProductsLoading");
  return <AdminTablePageSkeleton title={i18n("Loading products")} columns={9} />;
}
