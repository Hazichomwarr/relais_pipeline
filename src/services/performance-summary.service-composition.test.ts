import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * performance-summary.service.ts imports @/src/lib/prisma directly (no
 * DATABASE_URL in this environment), so — like every other impure
 * `*.service.ts` orchestrator in this repo — it can't be executed under
 * plain node:test. Asserted against the source, matching the convention
 * already used for page-level ordering checks (e.g.
 * app/admin/performance/performance-authorization.test.ts).
 */
const source = readFileSync("src/services/performance-summary.service.ts", "utf8");

test("Ticket 25K.1 §13/§14: canAssess is computed via the shared structured-evaluation authorization primitive, not re-derived or reused from canViewEmployeePerformance", () => {
  assert.match(source, /canAssessEmployeeInStructuredEvaluation\(/);
  const canAssessLine = source.match(/const canAssess = canAssessEmployeeInStructuredEvaluation\(\s*\n\s*actor,\s*\n\s*employee\.role,\s*\n\s*employee\.id,\s*\n\s*\);/);
  assert.ok(canAssessLine, "expected canAssess to be derived from actor/employee.role/employee.id");
});

test("Ticket 25K.1 §13/§14: the FOUND result carries canAssess as a field distinct from the view-authorization check already performed", () => {
  assert.match(source, /canViewEmployeePerformance\(actor\.role, employee\.role\)/);
  assert.match(source, /return \{ status: "FOUND", employee, summary, canAssess \};/);
});

test("Ticket 25K.1 §15: role support is checked before querying either structured-assessment table, so an unsupported role never triggers a lookup", () => {
  const roleResponsibilitiesCheckIndex = source.indexOf(
    "isRoleSupportedForRoleResponsibilityAssessment(",
  );
  const roleResponsibilitiesQueryIndex = source.indexOf(
    "getRoleResponsibilityAssessmentForEmployeePeriod(employeeId, period)",
  );
  const professionalContributionCheckIndex = source.indexOf(
    "isRoleSupportedForProfessionalContribution(",
  );
  const professionalContributionQueryIndex = source.indexOf(
    "getProfessionalContributionAssessmentForEmployeePeriod(employeeId, period)",
  );

  assert.ok(roleResponsibilitiesCheckIndex >= 0);
  assert.ok(roleResponsibilitiesQueryIndex >= 0);
  assert.ok(professionalContributionCheckIndex >= 0);
  assert.ok(professionalContributionQueryIndex >= 0);
  assert.ok(roleResponsibilitiesCheckIndex < roleResponsibilitiesQueryIndex);
  assert.ok(professionalContributionCheckIndex < professionalContributionQueryIndex);
});

test("Ticket 25K.1 §15: an unsupported role composes to UNSUPPORTED_ROLE, never NOT_STARTED, for both structured-assessment dimensions", () => {
  assert.match(
    source,
    /roleResponsibilities: roleResponsibilitySupported\s*\n\s*\? toStructuredAssessmentSummary\(roleResponsibilityRow, 20\)\s*\n\s*: \{\s*\n\s*status: "UNSUPPORTED_ROLE",\s*\n\s*score: null,\s*\n\s*maxScore: 20,\s*\n\s*assessmentId: null,\s*\n\s*evaluatorUserId: null,\s*\n\s*\},/,
  );
  assert.match(
    source,
    /professionalContribution: professionalContributionSupported\s*\n\s*\? toStructuredAssessmentSummary\(professionalContributionRow, 10\)\s*\n\s*: \{\s*\n\s*status: "UNSUPPORTED_ROLE",\s*\n\s*score: null,\s*\n\s*maxScore: 10,\s*\n\s*assessmentId: null,\s*\n\s*evaluatorUserId: null,\s*\n\s*\},/,
  );
});

test("Ticket 25O §23: evaluatorUserId is propagated into the composed summary alongside assessmentId, so the dashboard can compute per-dimension canContinue without a second lookup", () => {
  assert.match(source, /evaluatorUserId: row\.evaluatorUserId/);
});

test("Ticket 25K.1 §7: the assessment id is propagated into the composed summary so the navigation layer can deep-link without a second lookup", () => {
  assert.match(source, /assessmentId: row\.id/);
});

test("the actor parameter now requires an id (needed for self-assessment exclusion), not just a role", () => {
  assert.match(source, /actor: \{ id: string; role: UserRole \}/);
});
