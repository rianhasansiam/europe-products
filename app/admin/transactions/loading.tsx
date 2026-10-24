
import { useInterfaceTranslations } from "@/components/i18n/translate";
import { AdminTablePageSkeleton } from "@/components/ui/loading";

export default function Loading() {
  const i18n = useInterfaceTranslations("AdminAdminTransactionsLoading");
  return (
    <AdminTablePageSkeleton
      title={i18n("Loading transaction history")}
      columns={6}
    />
  );
}
