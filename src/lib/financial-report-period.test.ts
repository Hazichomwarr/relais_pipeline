import assert from "node:assert/strict";
import test from "node:test";

import {
  formatBusinessIsoDate,
  resolveFinancialReportPeriod,
} from "./financial-report-period";

function iso(instant: Date): string {
  return instant.toISOString();
}

test("today resolves to the current business-local calendar day, compared with yesterday", () => {
  const reference = new Date("2026-08-06T15:30:00.000Z");
  const resolved = resolveFinancialReportPeriod({ period: "today" }, reference);

  assert.equal(iso(resolved.from), "2026-08-06T00:00:00.000Z");
  assert.equal(iso(resolved.toExclusive), "2026-08-07T00:00:00.000Z");
  assert.equal(iso(resolved.previousFrom), "2026-08-05T00:00:00.000Z");
  assert.equal(iso(resolved.previousToExclusive), "2026-08-06T00:00:00.000Z");
  assert.equal(resolved.fromDateLabel, "2026-08-06");
  assert.equal(resolved.toDateLabel, "2026-08-06");
  assert.equal(resolved.label, "Aujourd’hui");
});

test("this week starts on Monday (reference is a Thursday) and compares with the previous Monday-Sunday", () => {
  // 2026-08-06 is a Thursday.
  const reference = new Date("2026-08-06T09:00:00.000Z");
  const resolved = resolveFinancialReportPeriod({ period: "week" }, reference);

  assert.equal(iso(resolved.from), "2026-08-03T00:00:00.000Z"); // Monday
  assert.equal(iso(resolved.toExclusive), "2026-08-10T00:00:00.000Z"); // next Monday
  assert.equal(iso(resolved.previousFrom), "2026-07-27T00:00:00.000Z");
  assert.equal(iso(resolved.previousToExclusive), "2026-08-03T00:00:00.000Z");
  assert.equal(resolved.fromDateLabel, "2026-08-03");
  assert.equal(resolved.toDateLabel, "2026-08-09");
});

test("this week resolves correctly when the reference date is itself a Sunday", () => {
  // 2026-08-09 is a Sunday — must still resolve to the Mon 08-03 .. Sun 08-09 week.
  const reference = new Date("2026-08-09T23:59:00.000Z");
  const resolved = resolveFinancialReportPeriod({ period: "week" }, reference);

  assert.equal(iso(resolved.from), "2026-08-03T00:00:00.000Z");
  assert.equal(iso(resolved.toExclusive), "2026-08-10T00:00:00.000Z");
});

test("this month covers the full calendar month and compares with the previous calendar month", () => {
  const reference = new Date("2026-08-20T00:00:00.000Z");
  const resolved = resolveFinancialReportPeriod({ period: "month" }, reference);

  assert.equal(iso(resolved.from), "2026-08-01T00:00:00.000Z");
  assert.equal(iso(resolved.toExclusive), "2026-09-01T00:00:00.000Z");
  assert.equal(iso(resolved.previousFrom), "2026-07-01T00:00:00.000Z");
  assert.equal(iso(resolved.previousToExclusive), "2026-08-01T00:00:00.000Z");
  assert.equal(resolved.fromDateLabel, "2026-08-01");
  assert.equal(resolved.toDateLabel, "2026-08-31");
});

test("this month correctly rolls the previous month back across a year boundary (January)", () => {
  const reference = new Date("2026-01-15T00:00:00.000Z");
  const resolved = resolveFinancialReportPeriod({ period: "month" }, reference);

  assert.equal(iso(resolved.from), "2026-01-01T00:00:00.000Z");
  assert.equal(iso(resolved.toExclusive), "2026-02-01T00:00:00.000Z");
  assert.equal(iso(resolved.previousFrom), "2025-12-01T00:00:00.000Z");
  assert.equal(iso(resolved.previousToExclusive), "2026-01-01T00:00:00.000Z");
});

test("this year covers Jan 1 - Dec 31 and compares with the previous calendar year", () => {
  const reference = new Date("2026-06-15T12:00:00.000Z");
  const resolved = resolveFinancialReportPeriod({ period: "year" }, reference);

  assert.equal(iso(resolved.from), "2026-01-01T00:00:00.000Z");
  assert.equal(iso(resolved.toExclusive), "2027-01-01T00:00:00.000Z");
  assert.equal(iso(resolved.previousFrom), "2025-01-01T00:00:00.000Z");
  assert.equal(iso(resolved.previousToExclusive), "2026-01-01T00:00:00.000Z");
  assert.equal(resolved.fromDateLabel, "2026-01-01");
  assert.equal(resolved.toDateLabel, "2026-12-31");
});

test("custom range is inclusive on both ends and compares with an immediately preceding range of equal duration", () => {
  const resolved = resolveFinancialReportPeriod({
    period: "custom",
    from: "2026-08-01",
    to: "2026-08-10",
  });

  assert.equal(iso(resolved.from), "2026-08-01T00:00:00.000Z");
  assert.equal(iso(resolved.toExclusive), "2026-08-11T00:00:00.000Z"); // exclusive, day after Aug 10
  assert.equal(resolved.fromDateLabel, "2026-08-01");
  assert.equal(resolved.toDateLabel, "2026-08-10");

  // 10 inclusive days (Aug 1-10) — the preceding range must be the same
  // 10-day duration immediately before, i.e. Jul 22 - Jul 31.
  assert.equal(iso(resolved.previousToExclusive), "2026-08-01T00:00:00.000Z");
  assert.equal(iso(resolved.previousFrom), "2026-07-22T00:00:00.000Z");
});

test("custom range spanning a single day works (from === to)", () => {
  const resolved = resolveFinancialReportPeriod({
    period: "custom",
    from: "2026-08-06",
    to: "2026-08-06",
  });

  assert.equal(iso(resolved.from), "2026-08-06T00:00:00.000Z");
  assert.equal(iso(resolved.toExclusive), "2026-08-07T00:00:00.000Z");
  assert.equal(iso(resolved.previousFrom), "2026-08-05T00:00:00.000Z");
  assert.equal(iso(resolved.previousToExclusive), "2026-08-06T00:00:00.000Z");
});

test("custom range spanning the Feb 29 leap day resolves correctly", () => {
  const resolved = resolveFinancialReportPeriod({
    period: "custom",
    from: "2024-02-28",
    to: "2024-03-01",
  });

  assert.equal(iso(resolved.from), "2024-02-28T00:00:00.000Z");
  assert.equal(iso(resolved.toExclusive), "2024-03-02T00:00:00.000Z");
  assert.equal(resolved.toDateLabel, "2024-03-01");
});

test("formatBusinessIsoDate pads single-digit months and days", () => {
  assert.equal(
    formatBusinessIsoDate(new Date("2026-01-05T10:00:00.000Z")),
    "2026-01-05",
  );
});
