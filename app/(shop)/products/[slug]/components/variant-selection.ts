export type VariantSelectionCandidate = {
  id: string;
  isActive: boolean;
};

/** Preselect the first active variant in the product's existing order. */
export function initialVariantSelectionId(
  variants: readonly VariantSelectionCandidate[],
): string | null {
  return variants.find((variant) => variant.isActive)?.id ?? null;
}
