import assert from "node:assert/strict";
import test from "node:test";

import {
  isSearchableSchoolName,
  MIN_SCHOOL_SEARCH_LENGTH,
  normalizeSchoolName,
} from "./school-name-normalization";

test("trims leading and trailing whitespace", () => {
  assert.equal(normalizeSchoolName("  École Horizon  "), "ecole horizon");
});

test("collapses repeated internal spaces", () => {
  assert.equal(normalizeSchoolName("École    Horizon"), "ecole horizon");
});

test("matches the ticket's worked example exactly", () => {
  assert.equal(
    normalizeSchoolName("  Lycée   Saint Viateur "),
    "lycee saint viateur",
  );
});

test("is case-insensitive", () => {
  assert.equal(
    normalizeSchoolName("ÉCOLE HORIZON"),
    normalizeSchoolName("école horizon"),
  );
});

test("folds accents for comparison", () => {
  assert.equal(normalizeSchoolName("Lycée"), normalizeSchoolName("Lycee"));
});

test("does not mutate the original string", () => {
  const original = "  Lycée   Saint Viateur ";
  normalizeSchoolName(original);
  assert.equal(original, "  Lycée   Saint Viateur ");
});

test("MIN_SCHOOL_SEARCH_LENGTH is 3", () => {
  assert.equal(MIN_SCHOOL_SEARCH_LENGTH, 3);
});

test("rejects a query below the minimum useful length", () => {
  assert.equal(isSearchableSchoolName("ec"), false);
});

test("accepts a query at the minimum useful length", () => {
  assert.equal(isSearchableSchoolName("eco"), true);
});

test("treats whitespace-only input as not searchable", () => {
  assert.equal(isSearchableSchoolName("     "), false);
});
