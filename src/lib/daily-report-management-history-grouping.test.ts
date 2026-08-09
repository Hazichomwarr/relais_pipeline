import assert from "node:assert/strict";
import test from "node:test";

import { groupDailyReportSummariesByDate } from "./daily-report-management-history-grouping";

test("groups contiguous same-day items into one group, preserving item order", () => {
  const groups = groupDailyReportSummariesByDate([
    { id: "a", reportDate: "2026-08-08" },
    { id: "b", reportDate: "2026-08-08" },
    { id: "c", reportDate: "2026-08-07" },
  ]);

  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].items.map((item) => item.id), ["a", "b"]);
  assert.deepEqual(groups[1].items.map((item) => item.id), ["c"]);
});

test("formats each group's label as a long French date", () => {
  const groups = groupDailyReportSummariesByDate([{ id: "a", reportDate: "2026-08-09" }]);

  assert.equal(groups[0].label, "9 août 2026");
});

test("an empty list produces no groups", () => {
  assert.deepEqual(groupDailyReportSummariesByDate([]), []);
});

test("preserves group order following input order, without re-sorting", () => {
  const groups = groupDailyReportSummariesByDate([
    { id: "a", reportDate: "2026-08-09" },
    { id: "b", reportDate: "2026-08-08" },
    { id: "c", reportDate: "2026-08-07" },
  ]);

  assert.deepEqual(
    groups.map((group) => group.reportDate),
    ["2026-08-09", "2026-08-08", "2026-08-07"],
  );
});
