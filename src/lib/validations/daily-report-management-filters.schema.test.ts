import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDailyReportManagementFilterUrl,
  parseDailyReportManagementFilters,
} from "./daily-report-management-filters.schema";

test("an empty query parses to no filters (defaults to today's dashboard)", () => {
  assert.deepEqual(parseDailyReportManagementFilters({}), {});
});

test("valid period/employeeId/templateType/state values all parse through", () => {
  const result = parseDailyReportManagementFilters({
    period: "last7",
    employeeId: "user-1",
    templateType: "OPERATIONS_COORDINATOR",
    state: "DRAFT",
  });

  assert.deepEqual(result, {
    period: "last7",
    employeeId: "user-1",
    templateType: "OPERATIONS_COORDINATOR",
    state: "DRAFT",
  });
});

test("an unrecognized period falls back to no filters at all, never a page error", () => {
  const result = parseDailyReportManagementFilters({
    period: "yesterday" as never,
  });

  assert.deepEqual(result, {});
});

test("an unrecognized templateType falls back to no filters at all", () => {
  const result = parseDailyReportManagementFilters({
    templateType: "SALES_MANAGER" as never,
  });

  assert.deepEqual(result, {});
});

test("buildDailyReportManagementFilterUrl omits the default 'today' period and empty fields", () => {
  assert.equal(buildDailyReportManagementFilterUrl({}, { period: "today" }), "/admin/reports");
});

test("buildDailyReportManagementFilterUrl serializes a non-default period", () => {
  assert.equal(
    buildDailyReportManagementFilterUrl({}, { period: "last7" }),
    "/admin/reports?period=last7",
  );
});

test("buildDailyReportManagementFilterUrl merges a change onto existing filters without dropping the others", () => {
  const current = { period: "last7" as const, templateType: "ASSISTANT" as const };
  const url = buildDailyReportManagementFilterUrl(current, { employeeId: "user-1" });

  assert.match(url, /period=last7/);
  assert.match(url, /templateType=ASSISTANT/);
  assert.match(url, /employeeId=user-1/);
});

test("buildDailyReportManagementFilterUrl clears a field when the change sets it to undefined", () => {
  const current = { employeeId: "user-1" as const };
  const url = buildDailyReportManagementFilterUrl(current, { employeeId: undefined });

  assert.doesNotMatch(url, /employeeId/);
});
