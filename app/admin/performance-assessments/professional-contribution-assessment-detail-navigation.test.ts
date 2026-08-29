import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * Transitively imports next-auth (via
 * requireProfessionalContributionAssessmentManagementAccess) — can't run
 * under plain node:test. Asserted against the source, matching the
 * convention used throughout the performance domain's page-level tests.
 *
 * This test file deliberately lives OUTSIDE the [assessmentId] directory
 * it targets: Node's test runner interprets `[...]` in a file path it is
 * given directly as a glob character class, not a literal folder name —
 * a test file placed inside a bracketed dynamic-route directory silently
 * matches zero files and never runs, with no error. readFileSync has no
 * such restriction, so the source path below still points at the real
 * page.
 */
const source = readFileSync(
  "app/admin/performance-assessments/professional-contribution/[assessmentId]/page.tsx",
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

test("Ticket 25K.2 §27: an assessment id in the URL is untrusted — the page re-checks canViewEmployeePerformance for THIS employee's role before rendering anything, not just the coarse ADMIN/MANAGER gate", () => {
  assert.match(
    source,
    /import \{ canViewEmployeePerformance \} from "@\/src\/services\/performance-summary\.service-core";/,
  );
  const checkIndex = source.indexOf(
    "canViewEmployeePerformance(actor.role, assessment.roleAtEvaluation)",
  );
  const notFoundIndex = source.indexOf("notFound();", checkIndex);
  assert.ok(checkIndex >= 0, "expected the per-employee view check");
  assert.ok(
    notFoundIndex > checkIndex,
    "expected notFound() to follow a failed view check, not an access-denied redirect that would confirm existence",
  );
});

test("Ticket 25K.2 §28/§29: canEdit requires both DRAFT status and evaluator ownership — never granted to a different authorized manager, mirroring 25J's own evaluatorUserId check", () => {
  assert.match(
    source,
    /const canEdit =\s*\n\s*assessment\.status === "DRAFT" && actor\.id === assessment\.evaluatorUserId;/,
  );
});

test("the actor captured from the coarse gate carries an id (needed for the ownership check), not just a role", () => {
  assert.match(
    source,
    /actor = \{ id: authenticated\.id, role: authenticated\.role as "ADMIN" \| "MANAGER" \};/,
  );
});

test("evaluatorName and canEdit are passed through to the detail component, which owns the read-only/editable split", () => {
  assert.match(source, /evaluatorName=\{`\$\{assessment\.evaluator\.firstName\} \$\{assessment\.evaluator\.lastName\}`\}/);
  assert.match(source, /canEdit=\{canEdit\}/);
});

test("Ticket 25K.2 §64: opening this page performs no mutation — only a read (getProfessionalContributionAssessmentDetail), no create/assess/submit/delete action import", () => {
  assert.match(source, /getProfessionalContributionAssessmentDetail\(/);
  assert.doesNotMatch(
    source,
    /createProfessionalContributionAssessmentAction|assessProfessionalContributionItemAction|submitProfessionalContributionAssessmentAction|deleteProfessionalContributionAssessmentAction/,
  );
});

test("Ticket 25K.2 §65: this is the exact canonical route 25K.1's dashboard Continuer l’évaluation/Voir le détail CTA already deep-links to — /admin/performance-assessments/professional-contribution/{assessmentId}, not a page-specific alternate", () => {
  const dashboardSource = readFileSync("app/admin/performance/page.tsx", "utf8");
  assert.match(
    dashboardSource,
    /detailHrefBase="\/admin\/performance-assessments\/professional-contribution"/,
  );
});
