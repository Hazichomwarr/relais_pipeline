import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * The /reports routes transitively import next-auth (via
 * requireAuthenticatedUser), so — like app/notes/notes-authorization.test.ts
 * — they can't be executed under plain node:test outside Next's runtime.
 * This asserts the required structure directly against the source instead.
 */
test("the reports layout gates on authentication alone — template assignment is resolved per-page, not per-role", () => {
  const source = readFileSync("app/reports/layout.tsx", "utf8");

  assert.match(source, /requireAuthenticatedUser\(\)/);
  assert.doesNotMatch(source, /requireRole\(/);
  assert.doesNotMatch(source, /requireAdmin\(/);
  assert.match(source, /redirect\("\/login"\)/);
});

test("the reports list page scopes today's report and history to the authenticated user's id, and never derives the template from user.role", () => {
  const source = readFileSync("app/reports/page.tsx", "utf8");

  assert.match(source, /requireAuthenticatedUser\(\)/);
  assert.match(source, /getOwnDailyReportTemplateType\(user\.id\)/);
  assert.match(source, /getOwnDailyReportForDate\(user\.id,/);
  assert.match(source, /listOwnDailyReports\(user\.id\)/);
  assert.doesNotMatch(source, /templateType\s*=\s*user\.role/);
  assert.doesNotMatch(source, /user\.role\s*===/);
  assert.match(source, /redirect\("\/login"\)/);
});

test("the report detail page scopes its lookup to the authenticated user's id and calls notFound() when absent", () => {
  const source = readFileSync("app/reports/[reportId]/page.tsx", "utf8");

  assert.match(source, /requireAuthenticatedUser\(\)/);
  assert.match(source, /getOwnDailyReportById\(user\.id, reportId\)/);
  assert.match(source, /if \(!report\) \{\s*notFound\(\);/);
});

test("a SUBMITTED report always renders the read-only view, never one of the editable forms", () => {
  const source = readFileSync("app/reports/[reportId]/page.tsx", "utf8");

  assert.match(
    source,
    /report\.status === "SUBMITTED" \? \(\s*<DailyReportReadOnlyView/,
  );
});

test("the report detail route has a dedicated not-found page with no ownership-revealing copy", () => {
  const source = readFileSync("app/reports/[reportId]/not-found.tsx", "utf8");

  assert.doesNotMatch(source, /appartient à un autre utilisateur/i);
});
