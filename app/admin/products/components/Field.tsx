"use client";

export default function Field({
  label,
  required,
  error,
  errorId,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  errorId?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className={`text-xs font-semibold uppercase tracking-wide ${error ? "text-red-700" : "text-gray-600"}`}>
        {label} {required && <span aria-hidden="true" className="text-red-600">*</span>}
      </span>
      {children}
      {error && <p id={errorId} className="text-xs font-medium text-red-700">{error}</p>}
    </label>
  );
}
