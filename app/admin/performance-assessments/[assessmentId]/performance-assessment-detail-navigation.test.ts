import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * Transitively imports next-auth (via
 * requireRoleResponsibilityAssessmentManagementAccess) — can't run under
 * plain node:test. Asserted against the source, matching the convention
 * used throughout the performance domain's page-level tests.
 */
const source = readFileSync(
  "app/admin/performance-assessments/[assessmentId]/page.tsx",
  "utf8",
);

test("Ticket 25K.1 §24: the return-to-dashboard link is a fixed internal path built from the assessment's own already-loaded employee/period, never a forwarded returnUrl query param", () => {
  assert.match(
    source,
    /const dashboardHref = `\/admin\/performance\?employeeId=\$\{assessment\.employeeUserId\}&year=\$\{assessment\.periodStart\.getUTCFullYear\(\)\}&month=\$\{assessment\.periodStart\.getUTCMonth\(\) \+ 1\}`;/,
  );
  assert.doesNotMatch(source, /returnUrl/);
});

test("Ticket 25K.1 §24: the original 'Retour aux évaluations' link is preserved alongside the new dashboard link, not replaced", () => {
  assert.match(source, /href="\/admin\/performance-assessments"/);
  assert.match(source, /Retour aux évaluations/);
  assert.match(source, /href=\{dashboardHref\}/);
  assert.match(source, /Retour à la vue d’ensemble/);
});
