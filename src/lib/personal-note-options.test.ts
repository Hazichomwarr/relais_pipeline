import assert from "node:assert/strict";
import test from "node:test";

import { personalNoteCategoryOptions } from "./personal-note-options";

test("has exactly the five fixed RELAIS categories", () => {
  assert.deepEqual(
    personalNoteCategoryOptions.map((option) => option.value),
    [
      "URGENT_TODO",
      "COMMERCIAL_DEBRIEF",
      "RELAIS_IDEA",
      "SCHOOL_DOCUMENTS",
      "OTHER",
    ],
  );
});

test("labels match the requested French wording exactly", () => {
  assert.deepEqual(
    personalNoteCategoryOptions.map((option) => option.label),
    [
      "À faire urgemment",
      "Préparer le débrief commercial",
      "Idées pour RELAIS",
      "Documents à envoyer aux écoles",
      "Autres",
    ],
  );
});

test("has no duplicate values", () => {
  const values = personalNoteCategoryOptions.map((option) => option.value);
  assert.equal(new Set(values).size, values.length);
});

test("has no duplicate labels", () => {
  const labels = personalNoteCategoryOptions.map((option) => option.label);
  assert.equal(new Set(labels).size, labels.length);
});
