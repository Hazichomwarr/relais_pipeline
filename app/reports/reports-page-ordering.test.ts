import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * Ticket 19A/19B requires the reports list to preserve the service's
 * ordering (reportDate DESC, id DESC — see compareDailyReportsForOwnHistory
 * in daily-report.service-core.ts) rather than re-sorting client-side.
 * Asserted against the source, the same technique this repo already uses
 * for app/notes/notes-page-ordering.test.ts, since this Server Component
 * transitively imports next-auth and can't run under plain node:test.
 */
test("the reports list page renders listOwnDailyReports results directly, without re-sorting", () => {
  const source = readFileSync("app/reports/page.tsx", "utf8");

  assert.match(source, /listOwnDailyReports\(user\.id\)/);
  assert.doesNotMatch(source, /history\.sort\(/);
  assert.doesNotMatch(source, /\.sort\(/);
});

test("DailyReportHistory renders the given reports array directly, without re-sorting", () => {
  const source = readFileSync(
    "component/daily-reports/DailyReportHistory.tsx",
    "utf8",
  );

  assert.match(source, /reports\.map\(/);
  assert.doesNotMatch(source, /\.sort\(/);
});
