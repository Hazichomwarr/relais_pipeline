import assert from "node:assert/strict";
import test from "node:test";

import {
  parseSalesWhyAnalyticsFilters,
  updateSalesWhyAnalyticsParam,
} from "./sales-why-analytics-filters";

test("defaults to period=month with no product/owner/outcome when nothing is provided", () => {
  assert.deepEqual(parseSalesWhyAnalyticsFilters({}), {
    period: "month",
    product: undefined,
    ownerUserId: undefined,
    outcome: undefined,
  });
});

test("accepts every valid period value", () => {
  for (const period of ["today", "week", "month", "year", "all"] as const) {
    assert.equal(parseSalesWhyAnalyticsFilters({ period }).period, period);
  }
});

test("a malformed period falls back to month rather than throwing", () => {
  assert.equal(parseSalesWhyAnalyticsFilters({ period: "garbage" }).period, "month");
  assert.equal(parseSalesWhyAnalyticsFilters({ period: "" }).period, "month");
});

test("an invalid product is ignored, not passed through", () => {
  assert.equal(
    parseSalesWhyAnalyticsFilters({ product: "INVALID" }).product,
    undefined,
  );
});

test("a valid product is passed through", () => {
  assert.equal(
    parseSalesWhyAnalyticsFilters({ product: "LOKARI" }).product,
    "LOKARI",
  );
});

test("an unknown owner id is passed through opaquely — a filter value, not something validated here", () => {
  assert.equal(
    parseSalesWhyAnalyticsFilters({ owner: "does-not-exist" }).ownerUserId,
    "does-not-exist",
  );
});

test("accepts every valid outcome value", () => {
  for (const outcome of ["ADVANCED", "STALLED", "WON", "LOST"] as const) {
    assert.equal(parseSalesWhyAnalyticsFilters({ outcome }).outcome, outcome);
  }
});

test("an invalid outcome falls back to undefined (all outcomes) rather than throwing", () => {
  assert.equal(
    parseSalesWhyAnalyticsFilters({ outcome: "GARBAGE" }).outcome,
    undefined,
  );
  assert.equal(parseSalesWhyAnalyticsFilters({ outcome: "" }).outcome, undefined);
});

test("query parameters cannot escape the intended scope: garbage input never throws and never reaches Prisma unvalidated", () => {
  assert.doesNotThrow(() =>
    parseSalesWhyAnalyticsFilters({
      period: "'; DROP TABLE Prospect;--",
      product: "<script>",
      owner: " ",
      outcome: "'; DROP TABLE ProspectActivity;--",
    }),
  );
  const result = parseSalesWhyAnalyticsFilters({
    period: "'; DROP TABLE Prospect;--",
    product: "<script>",
    outcome: "'; DROP TABLE ProspectActivity;--",
  });
  assert.equal(result.period, "month");
  assert.equal(result.product, undefined);
  assert.equal(result.outcome, undefined);
});

test("updateSalesWhyAnalyticsParam sets and clears params against the why analytics route", () => {
  assert.equal(
    updateSalesWhyAnalyticsParam("period=month", "product", "KARMDA"),
    "/admin/analytics/why?period=month&product=KARMDA",
  );
  assert.equal(
    updateSalesWhyAnalyticsParam("period=month&product=KARMDA", "product", ""),
    "/admin/analytics/why?period=month",
  );
});
