import { redirect } from "next/navigation";


import { requireAdmin } from "@/lib/api/guards";

import TransactionsClient from "./TransactionsClient";

export default async function AdminTransactionsPage() {
  const guard = await requireAdmin();

  if (!guard.ok) {
    if (guard.response.status === 401) {
      redirect("/login?callbackUrl=/admin/transactions");
    }
    redirect("/");
  }

  return <TransactionsClient />;
}
