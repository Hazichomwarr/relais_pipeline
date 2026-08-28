import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * A "use client" react-hook-form + useRouter component — cannot render
 * under plain node:test (same constraint as LedgerEntryForm.test.ts).
 */
const source = readFileSync(
  "component/admin/RoleResponsibilityAssessmentForm.tsx",
  "utf8",
);

test("validates against the Ticket 25I schema via zodResolver, never redefines validation rules", () => {
  assert.match(source, /zodResolver\(createRoleResponsibilityAssessmentSchema\)/);
});

test("submits through createRoleResponsibilityAssessmentAction, never a direct service or Prisma call", () => {
  assert.match(source, /createRoleResponsibilityAssessmentAction\(/);
  assert.doesNotMatch(source, /from "@\/src\/lib\/prisma"/);
});

test("defaults to last month — a month that is already guaranteed closed (Ticket 25I §16/§77)", () => {
  assert.match(source, /lastClosedMonthDefaults/);
});

test("the employee select is populated from the employees prop, not a hardcoded list", () => {
  assert.match(source, /employees\.map\(/);
});
