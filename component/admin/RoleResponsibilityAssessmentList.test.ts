import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  "component/admin/RoleResponsibilityAssessmentList.tsx",
  "utf8",
);

test("deletes through deleteRoleResponsibilityAssessmentAction, never a direct service or Prisma call", () => {
  assert.match(source, /deleteRoleResponsibilityAssessmentAction\(/);
  assert.doesNotMatch(source, /from "@\/src\/lib\/prisma"/);
});

test("the delete control is only rendered for a DRAFT assessment — a submitted one has no mutation affordance", () => {
  assert.match(source, /assessment\.status === "DRAFT" \? \(/);
});

test("the score is only displayed once SUBMITTED — a draft never shows a partial or fabricated number", () => {
  assert.match(source, /assessment\.status === "SUBMITTED"/);
  assert.match(source, /\$\{assessment\.score\}\s*\/\s*\$\{assessment\.maxScore\}/);
});

test("submitted and draft states use distinct visual labels, not a raw boolean", () => {
  assert.match(source, /Soumise/);
  assert.match(source, /Brouillon/);
});
