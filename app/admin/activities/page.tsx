import { redirect } from "next/navigation";


import { requireAdmin } from "@/lib/api/guards";

import ActivityLogClient from "./ActivityLogClient";

export default async function AdminActivityLogPage() {
  const guard = await requireAdmin();

  if (!guard.ok) {
    if (guard.response.status === 401) {
      redirect("/login?callbackUrl=/admin/activities");
    }
    redirect("/");
  }

  return <ActivityLogClient />;
}
