export const MIN_SCHOOL_SEARCH_LENGTH = 3;

const COMBINING_DIACRITICAL_MARKS = /\p{Diacritic}/gu;

/**
 * For comparison only — never rewrite the stored Prospect.name with this.
 * Strips accents so "Lycée" and "Lycee" compare equal, collapses repeated
 * whitespace, and lowercases for a stable comparison key.
 */
export function normalizeSchoolName(value: string): string {
  return value
    .normalize("NFD")
    .replace(COMBINING_DIACRITICAL_MARKS, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function isSearchableSchoolName(value: string): boolean {
  return normalizeSchoolName(value).length >= MIN_SCHOOL_SEARCH_LENGTH;
}
