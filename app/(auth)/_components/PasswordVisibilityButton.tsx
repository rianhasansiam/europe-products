"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { Eye, EyeOff } from "lucide-react";

type PasswordVisibilityButtonProps = {
  visible: boolean;
  onClick: () => void;
};

export default function PasswordVisibilityButton({
  visible,
  onClick,
}: PasswordVisibilityButtonProps) {
  const i18n = useInterfaceTranslations("InterfaceComponentsPasswordVisibilityButton");
  return (
    <button
      type="button"
      aria-label={visible ? i18n("Hide password") : i18n("Show password")}
      onClick={onClick}
      className="grid h-10 w-10 place-items-center rounded-lg text-muted-foreground transition-colors hover:text-primary"
    >
      {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );
}
