export function normalizeJobSearchQueries(searchQueries: string[]): string[] {
  return dedupeJobSearchQueries(searchQueries.map(normalizeJobSearchQuery).filter(hasSearchQueryValue));
}

export function createJobSearchQueries(searchQueries: string[], strictSearchMode: boolean): string[] {
  const normalizedSearchQueries = normalizeJobSearchQueries(searchQueries);

  if (!strictSearchMode) return normalizedSearchQueries;

  return dedupeJobSearchQueries([
    ...createStrictJobSearchQueries(normalizedSearchQueries),
    ...createLooseJobSearchQueries(normalizedSearchQueries),
  ]);
}

export function normalizeJobSearchQuery(searchQuery: string): string {
  const trimmedSearchQuery = searchQuery.trim();

  if (!isSingleTermExactSearchQuery(trimmedSearchQuery)) return trimmedSearchQuery;

  return trimmedSearchQuery.slice(1, -1).trim();
}

function createStrictJobSearchQueries(searchQueries: string[]): string[] {
  return searchQueries.map(createStrictJobSearchQuery);
}

function createLooseJobSearchQueries(searchQueries: string[]): string[] {
  return searchQueries.map(createLooseJobSearchQuery);
}

function createStrictJobSearchQuery(searchQuery: string): string {
  if (hasSurroundingDoubleQuotes(searchQuery)) return searchQuery;

  return `"${searchQuery}"`;
}

function createLooseJobSearchQuery(searchQuery: string): string {
  if (!hasSurroundingDoubleQuotes(searchQuery)) return searchQuery;

  return searchQuery.slice(1, -1).trim();
}

function dedupeJobSearchQueries(searchQueries: string[]): string[] {
  return Array.from(new Set(searchQueries));
}

function hasSearchQueryValue(searchQuery: string): boolean {
  return searchQuery.length > 0;
}

function isSingleTermExactSearchQuery(searchQuery: string): boolean {
  if (!hasSurroundingDoubleQuotes(searchQuery)) return false;

  return !/\s/.test(searchQuery.slice(1, -1).trim());
}

function hasSurroundingDoubleQuotes(value: string): boolean {
  if (value.length < 2) return false;
  if (!value.startsWith('"')) return false;

  return value.endsWith('"');
}
