
import { useInterfaceTranslations } from "@/components/i18n/translate";
import { AdminTablePageSkeleton } from "@/components/ui/loading";

export default function AdminManufacturersLoading() {
  const i18n = useInterfaceTranslations("AdminAdminManufacturersLoading");
  return <AdminTablePageSkeleton title={i18n("Loading manufacturers")} columns={6} />;
}
