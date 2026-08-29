import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * The performance dashboard page transitively imports next-auth (via
 * requireRole), so — like app/products/... — it can't be executed under
 * plain node:test outside Next's runtime. Asserted against the source.
 */
const source = readFileSync("app/admin/performance/page.tsx", "utf8");

test("the dashboard authorizes via requirePerformanceDashboardAccess before fetching any employee/period data", () => {
  const authorizeIndex = source.indexOf("requirePerformanceDashboardAccess(");
  const fetchIndex = source.indexOf("listUsers(");

  assert.ok(authorizeIndex >= 0, "requirePerformanceDashboardAccess() call not found");
  assert.ok(fetchIndex >= 0, "listUsers() call not found");
  assert.ok(authorizeIndex < fetchIndex);
});

test("redirects unauthenticated visitors to /login and unauthorized roles to /admin, same pattern as every other admin route", () => {
  assert.match(
    source,
    /redirect\(error\.code === "UNAUTHENTICATED" \? "\/login" : "\/admin"\)/,
  );
});

test("Ticket 25K §36: the actor's resolved role, not client input, is passed into getEmployeePerformanceSummary — IDOR protection against a spoofed scope", () => {
  assert.match(source, /getEmployeePerformanceSummary\(actor,/);
});

test("Ticket 25K §37/§41: the dashboard is read-only — no Server Action, no create/submit/delete call anywhere on the page", () => {
  assert.doesNotMatch(source, /Action\(/);
  assert.doesNotMatch(source, /"use client"/);
});

test("Ticket 25K §19: employees are listed via listUsers() (no active filter) so inactive/historical employees remain selectable, never hidden", () => {
  assert.match(source, /listUsers\(\)/);
  assert.doesNotMatch(source, /active:\s*true.*listUsers/);
});

test("Ticket 25K §60: no manual score input exists anywhere on the page", () => {
  assert.doesNotMatch(source, /<input[^>]*name="(score|overall)"/);
});

test("Ticket 25K §65: defaults to the latest closed calendar month, not the current open one", () => {
  assert.match(source, /latestClosedMonth\(\)/);
});

test("Ticket 25K §63: the selector is a plain GET form, matching this repo's existing filter convention — no client-side state", () => {
  assert.match(source, /method="get"/);
});

test("Ticket 25K.1 §13: the actor passed to getEmployeePerformanceSummary now carries an id (needed for assess-authority self-exclusion), not just a role", () => {
  assert.match(source, /actor = \{\s*\n\s*id: authenticated\.id,/);
});

test("Ticket 25K.1 §5/§6/§13: Role Responsibilities and Professional Contribution cards derive their CTA from getAssessmentActionState — never a hand-rolled matrix in JSX", () => {
  const humanDimensionUsages = source.match(/<HumanAssessedDimensionContent/g) ?? [];
  assert.equal(
    humanDimensionUsages.length,
    2,
    "expected exactly one HumanAssessedDimensionContent usage for each of the two human dimensions",
  );
  assert.match(source, /getAssessmentActionState\(\{/);
});

test("Ticket 25K.1 §16/§17: Results and Execution Discipline cards never render a HumanAssessedDimensionContent — no CTA exists for either, ever", () => {
  const resultsCard = source.match(
    /<DimensionCard\s+label=\{PERFORMANCE_DIMENSION_LABELS\.RESULTS\}[\s\S]*?\n\s*\/>/,
  );
  const executionCard = source.match(
    /<DimensionCard\s+label=\{PERFORMANCE_DIMENSION_LABELS\.EXECUTION_DISCIPLINE\}[\s\S]*?\n\s*\/>/,
  );

  assert.ok(resultsCard);
  assert.ok(executionCard);
  assert.doesNotMatch(resultsCard![0], /HumanAssessedDimensionContent/);
  assert.doesNotMatch(executionCard![0], /HumanAssessedDimensionContent/);
});

test("Ticket 25K.1 §7: the Role Responsibilities create CTA preserves employeeId/year/month as a deep link into the existing assessment workflow", () => {
  assert.match(
    source,
    /createHref=\{`\/admin\/performance-assessments\?employeeId=\$\{employeeId\}&year=\$\{year\}&month=\$\{month\}#role-responsibility`\}/,
  );
});

test("Ticket 25K.1 §7: the Professional Contribution create CTA deep-links to its own anchor, distinct from Role Responsibilities", () => {
  assert.match(
    source,
    /createHref=\{`\/admin\/performance-assessments\?employeeId=\$\{employeeId\}&year=\$\{year\}&month=\$\{month\}#professional-contribution`\}/,
  );
});

test("Ticket 25K.1 §12: no assessment is created as a side effect of rendering this page — no create/submit action import anywhere", () => {
  assert.doesNotMatch(source, /createRoleResponsibilityAssessmentAction|createProfessionalContributionAssessmentAction/);
});

test("Ticket 25K.1 §23: period-closedness is computed once from the already-resolved period, not re-derived from wall-clock inside the CTA logic", () => {
  assert.match(
    source,
    /const periodClosed = period\.periodEnd\.getTime\(\) <= new Date\(\)\.getTime\(\);/,
  );
});
