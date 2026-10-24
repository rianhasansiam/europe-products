"use client";

/**
 * Shared admin form field wrapper.
 *
 * Consolidates the previously duplicated `Field.tsx` files in:
 *   - app/admin/settings/components/Field.tsx   (superset — source of truth)
 *   - app/admin/categories/components/Field.tsx
 *   - app/admin/banners/components/Field.tsx
 *
 * NOTE: `app/admin/products/components/Field.tsx` is intentionally NOT
 * consolidated here — it uses a deliberately different visual style
 * (uppercase tracked label) and a different outer layout. Migrating it
 * would silently change the products form's appearance.
 */
export default function Field({
  label,
  hint,
  required,
  icon,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="flex items-center gap-1.5 font-semibold text-gray-700">
        {icon}
        {label}
        {required && <span className="ms-0.5 text-brand-red">*</span>}
      </span>
      {children}
      {hint && <span className="text-[11px] text-gray-500">{hint}</span>}
    </label>
  );
}
