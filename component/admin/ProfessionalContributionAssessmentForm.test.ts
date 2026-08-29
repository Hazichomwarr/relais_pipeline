import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  "component/admin/ProfessionalContributionAssessmentForm.tsx",
  "utf8",
);

test("validates against the Ticket 25J schema via zodResolver, never redefines validation rules", () => {
  assert.match(source, /zodResolver\(createProfessionalContributionAssessmentSchema\)/);
});

test("submits through createProfessionalContributionAssessmentAction, never a direct service or Prisma call", () => {
  assert.match(source, /createProfessionalContributionAssessmentAction\(/);
  assert.doesNotMatch(source, /from "@\/src\/lib\/prisma"/);
});

test("defaults to last month — a month that is already guaranteed closed", () => {
  assert.match(source, /lastClosedMonthDefaults/);
});

test("the employee select is populated from the employees prop, not a hardcoded list", () => {
  assert.match(source, /employees\.map\(/);
});

test("Ticket 25K.1 §7: accepts optional initialEmployeeId/initialYear/initialMonth props for dashboard deep-link prefill, falling back to the usual defaults when absent", () => {
  assert.match(source, /initialEmployeeId\?: string;/);
  assert.match(source, /initialYear\?: number;/);
  assert.match(source, /initialMonth\?: number;/);
  assert.match(source, /employeeId: initialEmployeeId \?\? "",/);
  assert.match(source, /year: initialYear \?\? defaults\.year,/);
  assert.match(source, /month: initialMonth \?\? defaults\.month,/);
});

test("Ticket 25K.2 §3/§4: on successful creation, redirects straight into the new draft using the durable assessmentId the action returns — no dead-end success message, no re-lookup by employee+period", () => {
  assert.match(
    source,
    /router\.push\(\s*\n\s*`\/admin\/performance-assessments\/professional-contribution\/\$\{result\.assessmentId\}`,\s*\n\s*\);/,
  );
  assert.doesNotMatch(source, /L.évaluation a été créée/);
});
