import type { Metadata } from "next";
import type { Session } from "next-auth";
import { redirect } from "next/navigation";


import AdminShell from "@/app/admin/components/AdminShell";
import { auth } from "@/lib/auth/auth";
import { toAppSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { noIndexMetadata } from "@/lib/seo/metadata";
import { getRequestLocale } from "@/lib/i18n/server";
import { localizeHref } from "@/lib/i18n/paths";
import LocaleSection from "@/components/i18n/LocaleSection";

export const metadata: Metadata = noIndexMetadata("Administration");
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = toAppSession((await auth()) as Session | null);
  const locale = await getRequestLocale();

  if (!session) {
    redirect(localizeHref(`/login?callbackUrl=${encodeURIComponent(localizeHref("/admin", locale))}`, locale));
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (currentUser?.role !== "ADMIN") {
    redirect(localizeHref("/", locale));
  }

  return <LocaleSection pathname="/admin"><AdminShell>{children}</AdminShell></LocaleSection>;
}
