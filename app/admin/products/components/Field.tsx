"use client";

export default function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">
        {label} {required ? "*" : ""}
      </span>
      {children}
    </label>
  );
}
