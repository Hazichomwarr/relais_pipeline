import assert from "node:assert/strict";
import test from "node:test";

import { getInitialsFromName } from "./initials";

test("getInitialsFromName combines the first letter of the first and last word", () => {
  assert.equal(getInitialsFromName("Julbert Serme"), "JS");
  assert.equal(getInitialsFromName("Odette Yaméogo"), "OY");
});

test("getInitialsFromName handles a three-word name by taking first and last", () => {
  assert.equal(getInitialsFromName("Marie Claire Ouédraogo"), "MO");
});

test("getInitialsFromName falls back to the first two letters of a single-word name", () => {
  assert.equal(getInitialsFromName("Odette"), "OD");
});

test("getInitialsFromName falls back to a placeholder for null, undefined, or blank names", () => {
  assert.equal(getInitialsFromName(null), "?");
  assert.equal(getInitialsFromName(undefined), "?");
  assert.equal(getInitialsFromName("   "), "?");
});
