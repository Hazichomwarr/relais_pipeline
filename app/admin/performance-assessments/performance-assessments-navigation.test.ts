import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * Like performance-authorization.test.ts, this page transitively imports
 * next-auth (via requireRoleResponsibilityAssessmentManagementAccess) and
 * can't run under plain node:test — asserted against the source.
 */
const source = readFileSync("app/admin/performance-assessments/page.tsx", "utf8");

test("Ticket 25K.1 §8/§9: no new query-param TYPE parameter was invented — the two sections share one page, distinguished by anchor, not a type= param", () => {
  assert.doesNotMatch(source, /type=/);
});

test("Ticket 25K.1 §7: employeeId/year/month are read from the query string to prefill both create forms, never trusted as authoritative", () => {
  assert.match(source, /searchParams: PerformanceAssessmentsSearchParams/);
  assert.match(source, /const initialEmployeeId = params\.employeeId \|\| undefined;/);
  assert.match(source, /const initialYear = parsePrefillYear\(params\.year\);/);
  assert.match(source, /const initialMonth = parsePrefillMonth\(params\.month\);/);
});

test("Ticket 25K.1 §43: a malformed month query param is rejected by parsePrefillMonth (returns undefined), never passed through as garbage", () => {
  const monthParserSource = source.match(/function parsePrefillMonth[\s\S]*?\n}/);
  assert.ok(monthParserSource);
  assert.match(monthParserSource![0], /value >= 1 && value <= 12/);
});

test("Ticket 25K.1 §7: both sections carry a stable anchor id for the dashboard's deep link to land on", () => {
  assert.match(source, /<section id="role-responsibility"/);
  assert.match(source, /<section id="professional-contribution"/);
});

test("Ticket 25K.1 §7: both create forms receive the prefill props, so navigating from either dimension's CTA prefills employee/period consistently", () => {
  const roleResponsibilityFormUsage = source.match(
    /<RoleResponsibilityAssessmentForm[\s\S]*?\/>/,
  );
  const professionalContributionFormUsage = source.match(
    /<ProfessionalContributionAssessmentForm[\s\S]*?\/>/,
  );

  for (const usage of [roleResponsibilityFormUsage, professionalContributionFormUsage]) {
    assert.ok(usage);
    assert.match(usage![0], /initialEmployeeId=\{initialEmployeeId\}/);
    assert.match(usage![0], /initialYear=\{initialYear\}/);
    assert.match(usage![0], /initialMonth=\{initialMonth\}/);
  }
});
