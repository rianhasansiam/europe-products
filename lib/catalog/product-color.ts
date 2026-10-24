export const PRODUCT_COLOR_HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/;
const PRODUCT_COLOR_HEX_BODY_PATTERN = /^[0-9A-Fa-f]{6}$/;
export const PRODUCT_COLOR_NAME_PATTERN =
  /^(?=.*\p{L})[\p{L}\p{N}][\p{L}\p{N}\p{M} .,'’&/+()-]*$/u;
export const PRODUCT_COLOR_MAX_LENGTH = 40;

export const PRODUCT_COLOR_VALIDATION_MESSAGE =
  "Color must be a name (for example Black or Pink) or a 6-digit HEX value (#RRGGBB).";

export function isSixDigitProductColor(value: string): boolean {
  return PRODUCT_COLOR_HEX_PATTERN.test(value);
}

export function isProductColorName(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.length > 0 &&
    trimmed.length <= PRODUCT_COLOR_MAX_LENGTH &&
    !PRODUCT_COLOR_HEX_BODY_PATTERN.test(trimmed) &&
    PRODUCT_COLOR_NAME_PATTERN.test(trimmed)
  );
}

export function isValidProductColor(value: string): boolean {
  const trimmed = value.trim();
  return isSixDigitProductColor(trimmed) || isProductColorName(trimmed);
}

export function normalizeProductColor(value: string): string {
  const normalized = value.trim().replace(/ +/g, " ");
  return isSixDigitProductColor(normalized)
    ? normalized.toUpperCase()
    : normalized;
}

type StoredProductColor = { value: string | null };

export type ProductColorWriteResult =
  | { success: true; value: string | null | undefined }
  | { success: false; message: string };

/**
 * Preserve an existing color byte-for-byte only when the submitted value is
 * unchanged. Every new or changed non-null value must be a readable color
 * name or strict six-digit HEX and is normalized before persistence.
 */
export function resolveProductColorWrite(
  value: string | null | undefined,
  stored?: StoredProductColor,
): ProductColorWriteResult {
  if (stored && value === stored.value) {
    return { success: true, value: stored.value };
  }

  if (value == null) {
    return { success: true, value };
  }

  const trimmed = value.trim();
  if (!isValidProductColor(trimmed)) {
    return { success: false, message: PRODUCT_COLOR_VALIDATION_MESSAGE };
  }

  return { success: true, value: normalizeProductColor(trimmed) };
}
