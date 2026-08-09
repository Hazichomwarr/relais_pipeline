import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * DailyReportManagementFilters is a "use client" component built on
 * next/navigation's useRouter, which can't run outside a mounted Next.js
 * app router under plain node:test (same constraint as
 * component/finances/LedgerHistoryFilters.test.ts). These assertions run
 * against the source directly.
 */
const source = readFileSync(
  "component/daily-reports/management/DailyReportManagementFilters.tsx",
  "utf8",
);

test("renders the three period tabs as plain URL-driven links", () => {
  assert.match(source, /label="Aujourd’hui"/);
  assert.match(source, /label="7 derniers jours"/);
  assert.match(source, /label="30 derniers jours"/);
  assert.match(source, /period: "today"/);
  assert.match(source, /period: "last7"/);
  assert.match(source, /period: "last30"/);
});

test("employee, template, and status are independent selects that push a merged URL", () => {
  assert.match(source, /employeeId: event\.target\.value \|\| undefined/);
  assert.match(source, /templateType: \(event\.target\.value \|\| undefined\)/);
  assert.match(source, /state: \(event\.target\.value \|\| undefined\)/);
});

test("template options reuse the centralized 19A label list, never a hand-duplicated one", () => {
  assert.match(
    source,
    /import\s*\{\s*dailyReportTemplateTypeOptions\s*\}\s*from\s*"@\/src\/lib\/constants\/daily-report-options"/,
  );
  assert.match(source, /dailyReportTemplateTypeOptions\.map\(/);
});

test("the Non commencé status option is only offered for the today period — it has no meaning historically", () => {
  const optionBlock = source.match(/<option value="">Tous<\/option>[\s\S]*?<\/select>/)?.[0];

  assert.ok(optionBlock, "status select block not found");
  assert.match(optionBlock!, /period === "today" &&/);
  assert.match(optionBlock!, /NOT_STARTED/);
});
