import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  "component/admin/ProfessionalContributionAssessmentList.tsx",
  "utf8",
);

test("deletes through deleteProfessionalContributionAssessmentAction, never a direct service or Prisma call", () => {
  assert.match(source, /deleteProfessionalContributionAssessmentAction\(/);
  assert.doesNotMatch(source, /from "@\/src\/lib\/prisma"/);
});

test("the delete control is only rendered for a DRAFT assessment — a submitted one has no mutation affordance", () => {
  assert.match(source, /assessment\.status === "DRAFT" \? \(/);
});

test("the score is only displayed once SUBMITTED — a draft never shows a partial or fabricated number", () => {
  assert.match(source, /assessment\.status === "SUBMITTED"/);
  assert.match(source, /\$\{assessment\.score\}\s*\/\s*\$\{assessment\.maxScore\}/);
});

test("links to the dedicated Professional Contribution detail route, not the Role Responsibility one", () => {
  assert.match(
    source,
    /\/admin\/performance-assessments\/professional-contribution\/\$\{assessment\.id\}/,
  );
});
