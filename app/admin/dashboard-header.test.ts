import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * Ticket 25E moves the total-prospect count out of the KPI grid and into
 * the dashboard header, reusing the same filtered `prospects` array that
 * already powers KpiCards/BusinessStats/DashboardTable (no second count
 * query). Asserted against the source, the same technique this repo
 * already uses for app/reports/reports-page-ordering.test.ts, since this
 * Server Component transitively imports next-auth and can't run under
 * plain node:test.
 */
test("the admin dashboard header renders the filtered prospect total alongside the date filter, without a second query", () => {
  const source = readFileSync("app/admin/page.tsx", "utf8");

  const headerStart = source.indexOf("Tableau de bord");
  const totalIndex = source.indexOf("{prospects.length}");
  const dateFilterIndex = source.indexOf("<ReportDateFilter");
  const kpiCardsIndex = source.indexOf("<KpiCards");

  assert.ok(headerStart >= 0, "header title not found");
  assert.ok(totalIndex >= 0, "{prospects.length} not rendered in the header");
  assert.ok(dateFilterIndex >= 0, "ReportDateFilter not found");

  // the total and the date filter live in the same header block, above the KPI grid
  assert.ok(totalIndex > headerStart && totalIndex < dateFilterIndex);
  assert.ok(dateFilterIndex < kpiCardsIndex);

  assert.match(source, /prospect\{prospects\.length > 1 \? "s" : ""\}/);

  // only one fetch of the filtered prospect list backs both the header total and the KPI grid
  const getProspectsCalls = source.match(/getProspects\(/g) ?? [];
  assert.equal(getProspectsCalls.length, 1);
});

test("KpiCards no longer receives a separate total-prospects prop or renders a standalone Prospects card", () => {
  const source = readFileSync(
    "component/dashboard/KpiCards.tsx",
    "utf8",
  );

  assert.doesNotMatch(source, /label:\s*"Prospects",/);
  assert.doesNotMatch(source, /Tous produits confondus/);
});
