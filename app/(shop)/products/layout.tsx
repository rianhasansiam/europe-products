import LocaleSection from "@/components/i18n/LocaleSection";
export default function ProductsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <LocaleSection pathname="/products">{children}</LocaleSection>;
}
