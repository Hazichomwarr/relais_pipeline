import assert from "node:assert/strict";
import test from "node:test";

import {
  describeDimensionUnavailability,
  formatAchievementRate,
  formatPeriodLabel,
  latestClosedMonth,
  PERFORMANCE_DIMENSION_LABELS,
} from "./performance-summary-presentation";

// ---------------------------------------------------------------------------
// §26/§27/§85: achievementRate is a raw ratio — only display converts it
// ---------------------------------------------------------------------------

test("§85: a raw ratio of 1.75 renders as 175 %, not 1.75 %", () => {
  assert.equal(formatAchievementRate(1.75), "175 %");
});

test("a raw ratio of 0.75 renders as 75 %", () => {
  assert.equal(formatAchievementRate(0.75), "75 %");
});

test("§86: a raw ratio of 0 renders as 0 %, not a missing value", () => {
  assert.equal(formatAchievementRate(0), "0 %");
});

test("achievementRate rounds to the nearest whole percentage", () => {
  assert.equal(formatAchievementRate(0.333), "33 %");
});

// ---------------------------------------------------------------------------
// §28/§38: internal identifiers never leak — every status gets real copy
// ---------------------------------------------------------------------------

test("§28: LEGACY_ATTRIBUTION_INCOMPLETE never appears verbatim in the message — it becomes a full explanatory sentence", () => {
  const message = describeDimensionUnavailability(
    "RESULTS",
    "LEGACY_ATTRIBUTION_INCOMPLETE",
  );
  assert.doesNotMatch(message, /LEGACY_ATTRIBUTION_INCOMPLETE/);
  assert.match(message, /victoires historiques/);
});

test("§38: NO_TARGET produces the exact historically-honest message — no impossible call-to-action for a closed period", () => {
  const message = describeDimensionUnavailability("RESULTS", "NO_TARGET");
  assert.match(message, /Aucun objectif n’avait été défini/);
});

test("no raw status string ever appears in any produced message, for any known status", () => {
  const knownStatuses = [
    "NO_TARGET",
    "LEGACY_ATTRIBUTION_INCOMPLETE",
    "INVALID_TARGET",
    "INSUFFICIENT_EVIDENCE",
    "UNSUPPORTED_ROLE",
    "PERIOD_NOT_CLOSED",
    "EMPLOYEE_NOT_FOUND",
    "DRAFT",
    "NOT_STARTED",
  ];

  for (const status of knownStatuses) {
    for (const dimension of [
      "RESULTS",
      "EXECUTION_DISCIPLINE",
      "ROLE_RESPONSIBILITIES",
      "PROFESSIONAL_CONTRIBUTION",
    ] as const) {
      const message = describeDimensionUnavailability(dimension, status);
      assert.doesNotMatch(message, new RegExp(status));
      assert.ok(message.length > 0);
    }
  }
});

test("an unrecognized status still produces a safe generic message, never throws or leaks the raw value", () => {
  const message = describeDimensionUnavailability("RESULTS", "SOME_FUTURE_STATUS");
  assert.doesNotMatch(message, /SOME_FUTURE_STATUS/);
  assert.ok(message.length > 0);
});

test("UNSUPPORTED_ROLE reads differently for machine-derived vs. structured-assessment dimensions", () => {
  const machineMessage = describeDimensionUnavailability(
    "RESULTS",
    "UNSUPPORTED_ROLE",
  );
  const assessmentMessage = describeDimensionUnavailability(
    "ROLE_RESPONSIBILITIES",
    "UNSUPPORTED_ROLE",
  );
  assert.notEqual(machineMessage, assessmentMessage);
});

// ---------------------------------------------------------------------------
// Dimension labels and period formatting
// ---------------------------------------------------------------------------

test("every dimension key has a French label", () => {
  assert.equal(PERFORMANCE_DIMENSION_LABELS.RESULTS, "Résultats");
  assert.equal(
    PERFORMANCE_DIMENSION_LABELS.EXECUTION_DISCIPLINE,
    "Discipline d’exécution",
  );
  assert.equal(
    PERFORMANCE_DIMENSION_LABELS.ROLE_RESPONSIBILITIES,
    "Responsabilités de rôle",
  );
  assert.equal(
    PERFORMANCE_DIMENSION_LABELS.PROFESSIONAL_CONTRIBUTION,
    "Contribution professionnelle",
  );
});

test("formatPeriodLabel renders a human month/year label", () => {
  assert.equal(formatPeriodLabel(2026, 8), "Août 2026");
  assert.equal(formatPeriodLabel(2026, 1), "Janvier 2026");
  assert.equal(formatPeriodLabel(2026, 12), "Décembre 2026");
});

// ---------------------------------------------------------------------------
// §65: default period is the latest closed calendar month
// ---------------------------------------------------------------------------

test("§65: latestClosedMonth returns the previous calendar month within the same year", () => {
  assert.deepEqual(
    latestClosedMonth(new Date("2026-08-15T00:00:00.000Z")),
    { year: 2026, month: 7 },
  );
});

test("§65: latestClosedMonth correctly rolls back across a year boundary in January", () => {
  assert.deepEqual(
    latestClosedMonth(new Date("2026-01-15T00:00:00.000Z")),
    { year: 2025, month: 12 },
  );
});
