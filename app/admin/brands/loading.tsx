
import { useInterfaceTranslations } from "@/components/i18n/translate";
import { AdminTablePageSkeleton } from "@/components/ui/loading";

export default function AdminBrandsLoading() {
  const i18n = useInterfaceTranslations("AdminAdminBrandsLoading");
  return <AdminTablePageSkeleton title={i18n("Loading brands")} columns={6} />;
}
