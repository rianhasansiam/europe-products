const DEFAULT_RECOMMENDATION_LIMIT = 5;
export const MIN_CATALOG_SEARCH_LENGTH = 2;

export function shouldRequestCatalogSearch(query: string): boolean {
  return query.trim().length >= MIN_CATALOG_SEARCH_LENGTH;
}

/**
 * Build a small, stable list of search phrases from admin-ordered catalog
 * labels. Empty queries return the leading recommendations; typed queries
 * prioritize prefix matches before broader substring matches.
 */
export function buildSearchRecommendations(
  candidates: readonly string[],
  query = "",
  limit = DEFAULT_RECOMMENDATION_LIMIT,
): string[] {
  if (limit <= 0) return [];

  const unique = new Map<string, string>();
  for (const candidate of candidates) {
    const phrase = candidate.trim();
    if (!phrase) continue;

    const normalized = phrase.toLocaleLowerCase();
    if (!unique.has(normalized)) unique.set(normalized, phrase);
  }

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const phrases = [...unique.values()];
  if (!normalizedQuery) return phrases.slice(0, limit);

  return phrases
    .filter((phrase) => phrase.toLocaleLowerCase().includes(normalizedQuery))
    .sort((left, right) => {
      const leftStarts = left.toLocaleLowerCase().startsWith(normalizedQuery);
      const rightStarts = right.toLocaleLowerCase().startsWith(normalizedQuery);
      if (leftStarts !== rightStarts) return leftStarts ? -1 : 1;
      return left.localeCompare(right);
    })
    .slice(0, limit);
}
