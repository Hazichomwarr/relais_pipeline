import assert from "node:assert/strict";
import test from "node:test";

import {
  formatDailyReportIsoDate,
  getCurrentBusinessDate,
  resolveDailyReportDate,
} from "./daily-report-date";

function iso(instant: Date): string {
  return instant.toISOString();
}

test("two instants on the same Burkina Faso business day normalize to the same reportDate", () => {
  const morning = getCurrentBusinessDate(new Date("2026-08-09T06:00:00.000Z"));
  const evening = getCurrentBusinessDate(new Date("2026-08-09T23:59:59.000Z"));

  assert.equal(iso(morning), iso(evening));
  assert.equal(iso(morning), "2026-08-09T00:00:00.000Z");
});

test("a report submitted at 16:50 still concerns that same business day", () => {
  const submittedAt = new Date("2026-08-09T16:50:00.000Z");
  const reportDate = getCurrentBusinessDate(submittedAt);

  assert.equal(iso(reportDate), "2026-08-09T00:00:00.000Z");
});

test("different calendar days normalize to different reportDate values", () => {
  const day1 = getCurrentBusinessDate(new Date("2026-08-09T12:00:00.000Z"));
  const day2 = getCurrentBusinessDate(new Date("2026-08-10T00:00:01.000Z"));

  assert.notEqual(iso(day1), iso(day2));
});

test("Africa/Ouagadougou is UTC+0, so the server's own UTC clock never shifts the intended business date", () => {
  const justBeforeMidnightUtc = getCurrentBusinessDate(
    new Date("2026-08-09T23:59:59.999Z"),
  );
  const justAfterMidnightUtc = getCurrentBusinessDate(
    new Date("2026-08-10T00:00:00.000Z"),
  );

  assert.equal(iso(justBeforeMidnightUtc), "2026-08-09T00:00:00.000Z");
  assert.equal(iso(justAfterMidnightUtc), "2026-08-10T00:00:00.000Z");
});

test("resolveDailyReportDate parses a form-submitted business date to the same normalized instant getCurrentBusinessDate would produce", () => {
  const fromForm = resolveDailyReportDate("2026-08-09");
  const fromNow = getCurrentBusinessDate(new Date("2026-08-09T10:00:00.000Z"));

  assert.equal(iso(fromForm), iso(fromNow));
});

test("month boundary: the last day of August and the first day of September remain distinct", () => {
  const lastOfAugust = resolveDailyReportDate("2026-08-31");
  const firstOfSeptember = resolveDailyReportDate("2026-09-01");

  assert.equal(iso(lastOfAugust), "2026-08-31T00:00:00.000Z");
  assert.equal(iso(firstOfSeptember), "2026-09-01T00:00:00.000Z");
  assert.notEqual(iso(lastOfAugust), iso(firstOfSeptember));
});

test("year boundary: December 31 and January 1 of the next year remain distinct", () => {
  const endOfYear = resolveDailyReportDate("2026-12-31");
  const startOfNextYear = resolveDailyReportDate("2027-01-01");

  assert.equal(iso(endOfYear), "2026-12-31T00:00:00.000Z");
  assert.equal(iso(startOfNextYear), "2027-01-01T00:00:00.000Z");
  assert.notEqual(iso(endOfYear), iso(startOfNextYear));
});

test("formatDailyReportIsoDate is the inverse of resolveDailyReportDate for a normalized business date", () => {
  const normalized = resolveDailyReportDate("2026-08-09");

  assert.equal(formatDailyReportIsoDate(normalized), "2026-08-09");
});
