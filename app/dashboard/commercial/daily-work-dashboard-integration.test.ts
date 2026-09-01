import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * app/dashboard/commercial/page.tsx transitively imports next-auth, so —
 * like every other Server Component page-content test in this repo — it
 * can't be executed under plain node:test. Asserted against the source.
 */
const source = readFileSync("app/dashboard/commercial/page.tsx", "utf8");

test("Ticket 27H §51: Commercial dashboard exposes an unconditional Ma journée DailyWorkEntryCard pointing to /ma-journee", () => {
  const entryMatch = source.match(
    /<DailyWorkEntryCard[\s\S]*?title="Ma journée"[\s\S]*?\/>/,
  );
  assert.ok(entryMatch, "expected a Ma journée DailyWorkEntryCard");
  assert.match(entryMatch![0], /href="\/ma-journee"/);
});

test("Ticket 27H §51: the Commercial dashboard's Ma journée entry appears exactly once, right after the header, before the KPI cards", () => {
  const occurrences = source.match(/title="Ma journée"/g) ?? [];
  assert.equal(occurrences.length, 1);

  const headerIndex = source.indexOf("<CommercialHeader");
  const entryIndex = source.indexOf('title="Ma journée"');
  const kpiIndex = source.indexOf("<CommercialKpiCards");

  assert.ok(headerIndex >= 0 && entryIndex > headerIndex);
  assert.ok(kpiIndex >= 0 && kpiIndex > entryIndex);
});

test("Ticket 27H §18: no new dashboard KPI (attendance/lateness/completion-rate) was introduced alongside the Daily Work entry card", () => {
  for (const forbidden of [
    "Agents présents",
    "Retards",
    "Taux de présence",
    "Productivité",
  ]) {
    assert.doesNotMatch(source, new RegExp(forbidden));
  }
});
