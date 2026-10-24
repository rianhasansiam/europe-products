export type VariantAttributeMap = Record<string, string>;

function optionToken(value: string): string {
  return encodeURIComponent(
    value
      .normalize("NFKC")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase(),
  );
}

/** Keep only non-empty string attributes and return them in stable key order. */
export function cleanVariantAttributes(value: unknown): VariantAttributeMap | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const normalized = new Map<string, { key: string; value: string }>();
  for (const [rawKey, rawValue] of Object.entries(value)) {
    if (typeof rawValue !== "string") continue;
    const key = rawKey.trim();
    const attributeValue = rawValue.trim();
    if (!key || !attributeValue) continue;
    const normalizedKey = optionToken(key);
    if (!normalizedKey) continue;
    normalized.set(normalizedKey, { key, value: attributeValue });
  }

  const entries = [...normalized.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, entry]) => [entry.key, entry.value] as const);
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

/**
 * Stable database key for a purchasable option combination. Size/color
 * shortcuts participate in the same namespace as arbitrary attributes.
 */
export function deriveVariantKey(input: {
  size?: string | null;
  color?: string | null;
  attributes?: unknown;
}): string {
  const values = new Map<string, string>();
  const attributes = cleanVariantAttributes(input.attributes);
  for (const [key, value] of Object.entries(attributes ?? {})) {
    values.set(optionToken(key), optionToken(value));
  }

  const size = input.size?.trim();
  const color = input.color?.trim();
  if (size) values.set("size", optionToken(size));
  if (color) values.set("color", optionToken(color));

  const entries = [...values.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  );
  if (entries.length === 0) return "default";
  return entries.map(([key, value]) => `${key}=${value}`).join("|");
}

export function formatVariantAttributes(value: unknown): string | null {
  const attributes = cleanVariantAttributes(value);
  if (!attributes) return null;
  return Object.entries(attributes)
    .map(([key, attributeValue]) => `${key}: ${attributeValue}`)
    .join(" · ");
}
