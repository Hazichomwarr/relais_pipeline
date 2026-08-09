import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * The /admin/reports routes transitively import next-auth (via
 * requireDailyReportManagementAccess), so — like
 * app/finances/finances-authorization.test.ts — they can't be executed
 * under plain node:test outside Next's runtime. These assertions run
 * against the source directly instead.
 */

test("the management reports layout gates on requireDailyReportManagementAccess — the existing 19A policy, not a new one", () => {
  const source = readFileSync("app/admin/reports/layout.tsx", "utf8");

  assert.match(source, /requireDailyReportManagementAccess\(\)/);
  assert.doesNotMatch(source, /requireRole\(/);
  assert.doesNotMatch(source, /requireAdmin\(/);
  assert.match(
    source,
    /error\.code === "UNAUTHENTICATED" \? "\/login" : "\/dashboard\/commercial"/,
  );
});

test("the management reports layout redirects before any report data is fetched", () => {
  const source = readFileSync("app/admin/reports/layout.tsx", "utf8");

  assert.doesNotMatch(source, /getDailyReportManagementDashboard\(/);
  assert.doesNotMatch(source, /listDailyReportsForManagement\(/);
});

test("the management reports page does not re-run authorization itself — it relies on the layout", () => {
  const source = readFileSync("app/admin/reports/page.tsx", "utf8");

  assert.doesNotMatch(source, /requireDailyReportManagementAccess\(/);
  assert.doesNotMatch(source, /requireRole\(/);
  assert.match(source, /Authorization already happened/);
});

test("the management reports page never queries Prisma directly", () => {
  const source = readFileSync("app/admin/reports/page.tsx", "utf8");

  assert.doesNotMatch(source, /prisma\./);
});

test("today's view uses the expected-reporter dashboard; historical periods use the plain persisted-report list — never the same code path", () => {
  const source = readFileSync("app/admin/reports/page.tsx", "utf8");

  assert.match(source, /getDailyReportManagementDashboard\(/);
  assert.match(source, /listDailyReportsForManagement\(/);
  assert.match(source, /period !== "today"/);
});

test("the historical branch never passes a NOT_STARTED status through to the persisted-report query", () => {
  const source = readFileSync("app/admin/reports/page.tsx", "utf8");

  assert.match(
    source,
    /status: filters\.state === "NOT_STARTED" \? undefined : filters\.state/,
  );
});

test("no report mutation is imported anywhere on the management pages (Ticket 19C is read-only)", () => {
  const pageSource = readFileSync("app/admin/reports/page.tsx", "utf8");
  const detailSource = readFileSync("app/admin/reports/[reportId]/page.tsx", "utf8");

  for (const source of [pageSource, detailSource]) {
    assert.doesNotMatch(source, /createOwnDailyReport/);
    assert.doesNotMatch(source, /updateOwnDailyReport/);
    assert.doesNotMatch(source, /submitOwnDailyReport/);
    assert.doesNotMatch(source, /daily-report\.actions/);
  }
});

test("the management detail page scopes its lookup through getDailyReportForManagement and calls notFound() when absent", () => {
  const source = readFileSync("app/admin/reports/[reportId]/page.tsx", "utf8");

  assert.match(source, /getDailyReportForManagement\(reportId\)/);
  assert.match(source, /if \(!report\) \{\s*notFound\(\);/);
});

test("the management detail page renders from the report's own stored templateType/templateData, never a live user lookup", () => {
  const source = readFileSync("app/admin/reports/[reportId]/page.tsx", "utf8");

  assert.match(source, /report\.templateType/);
  assert.match(source, /report\.templateData/);
  assert.doesNotMatch(source, /getOwnDailyReportTemplateType/);
  assert.doesNotMatch(source, /dailyReportTemplateType/);
});

test("the management detail page renders no edit, submit, or delete control", () => {
  const source = readFileSync("app/admin/reports/[reportId]/page.tsx", "utf8");

  assert.doesNotMatch(source, /<form/i);
  assert.doesNotMatch(source, /Enregistrer/);
  assert.doesNotMatch(source, /Envoyer le rapport/);
  assert.doesNotMatch(source, /Supprimer/);
});
