import assert from "node:assert/strict";
import test from "node:test";

import { parseFinancialReportFilter } from "./financial-report-filter.schema";

test("accepts each valid preset period", () => {
  assert.deepEqual(parseFinancialReportFilter({ period: "today" }), {
    period: "today",
  });
  assert.deepEqual(parseFinancialReportFilter({ period: "week" }), {
    period: "week",
  });
  assert.deepEqual(parseFinancialReportFilter({ period: "month" }), {
    period: "month",
  });
  assert.deepEqual(parseFinancialReportFilter({ period: "year" }), {
    period: "year",
  });
});

test("falls back to month when period is missing", () => {
  assert.deepEqual(parseFinancialReportFilter({}), { period: "month" });
});

test("falls back to month when period is an unrecognized value", () => {
  assert.deepEqual(parseFinancialReportFilter({ period: "decade" }), {
    period: "month",
  });
});

test("accepts a valid custom range", () => {
  assert.deepEqual(
    parseFinancialReportFilter({
      period: "custom",
      from: "2026-08-01",
      to: "2026-08-10",
    }),
    { period: "custom", from: "2026-08-01", to: "2026-08-10" },
  );
});

test("rejects a custom range with from after to, defaulting to today instead of jumping to month", () => {
  const reference = new Date("2026-08-06T12:00:00.000Z");
  const result = parseFinancialReportFilter(
    { period: "custom", from: "2026-08-10", to: "2026-08-01" },
    reference,
  );

  assert.deepEqual(result, {
    period: "custom",
    from: "2026-08-06",
    to: "2026-08-06",
  });
});

test("custom with missing dates defaults to today rather than falling back to month", () => {
  const reference = new Date("2026-08-06T12:00:00.000Z");
  const result = parseFinancialReportFilter({ period: "custom" }, reference);

  assert.deepEqual(result, {
    period: "custom",
    from: "2026-08-06",
    to: "2026-08-06",
  });
});

test("custom with a malformed date string defaults to today", () => {
  const reference = new Date("2026-08-06T12:00:00.000Z");
  const result = parseFinancialReportFilter(
    { period: "custom", from: "not-a-date", to: "2026-08-10" },
    reference,
  );

  assert.deepEqual(result, {
    period: "custom",
    from: "2026-08-06",
    to: "2026-08-06",
  });
});

test("custom with an impossible calendar date (Feb 30) defaults to today", () => {
  const reference = new Date("2026-08-06T12:00:00.000Z");
  const result = parseFinancialReportFilter(
    { period: "custom", from: "2026-02-30", to: "2026-03-01" },
    reference,
  );

  assert.deepEqual(result, {
    period: "custom",
    from: "2026-08-06",
    to: "2026-08-06",
  });
});
