import LocaleSection from "@/components/i18n/LocaleSection";

export default function FeatureLayout({ children }: { children: React.ReactNode }) {
  return <LocaleSection pathname="/terms-and-conditions">{children}</LocaleSection>;
}
