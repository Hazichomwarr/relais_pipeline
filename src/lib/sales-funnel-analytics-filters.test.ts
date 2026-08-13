import assert from "node:assert/strict";
import test from "node:test";

import {
  parseSalesFunnelAnalyticsFilters,
  updateSalesFunnelAnalyticsParam,
} from "./sales-funnel-analytics-filters";

test("defaults to period=month with no product/owner when nothing is provided", () => {
  assert.deepEqual(parseSalesFunnelAnalyticsFilters({}), {
    period: "month",
    product: undefined,
    ownerUserId: undefined,
  });
});

test("accepts every valid period value", () => {
  for (const period of ["today", "week", "month", "year", "all"] as const) {
    assert.equal(parseSalesFunnelAnalyticsFilters({ period }).period, period);
  }
});

test("a malformed period falls back to month rather than throwing", () => {
  assert.equal(parseSalesFunnelAnalyticsFilters({ period: "garbage" }).period, "month");
  assert.equal(parseSalesFunnelAnalyticsFilters({ period: "" }).period, "month");
});

test("an invalid product is ignored, not passed through", () => {
  assert.equal(
    parseSalesFunnelAnalyticsFilters({ product: "INVALID" }).product,
    undefined,
  );
});

test("a valid product is passed through", () => {
  assert.equal(
    parseSalesFunnelAnalyticsFilters({ product: "LOKARI" }).product,
    "LOKARI",
  );
});

test("an unknown owner id is passed through opaquely — a filter value, not something validated here", () => {
  assert.equal(
    parseSalesFunnelAnalyticsFilters({ owner: "does-not-exist" }).ownerUserId,
    "does-not-exist",
  );
});

test("query parameters cannot escape the intended scope: garbage input never throws and never reaches Prisma unvalidated", () => {
  assert.doesNotThrow(() =>
    parseSalesFunnelAnalyticsFilters({
      period: "'; DROP TABLE Prospect;--",
      product: "<script>",
      owner: " ",
    }),
  );
  const result = parseSalesFunnelAnalyticsFilters({
    period: "'; DROP TABLE Prospect;--",
    product: "<script>",
  });
  assert.equal(result.period, "month");
  assert.equal(result.product, undefined);
});

test("updateSalesFunnelAnalyticsParam sets and clears params against the funnel analytics route", () => {
  assert.equal(
    updateSalesFunnelAnalyticsParam("period=month", "product", "KARMDA"),
    "/admin/analytics/funnel?period=month&product=KARMDA",
  );
  assert.equal(
    updateSalesFunnelAnalyticsParam("period=month&product=KARMDA", "product", ""),
    "/admin/analytics/funnel?period=month",
  );
});
