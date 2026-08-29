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
