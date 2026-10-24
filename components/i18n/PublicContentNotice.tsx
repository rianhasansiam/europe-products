"use client";
import { useTranslations } from "next-intl";

export default function PublicContentNotice({available}:{available:boolean}){
  const t=useTranslations("Language");
  if(available)return null;
  return <p role="status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{t("unavailable")}</p>;
}
