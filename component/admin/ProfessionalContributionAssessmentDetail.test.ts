import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  "component/admin/ProfessionalContributionAssessmentDetail.tsx",
  "utf8",
);

test("assesses items through assessProfessionalContributionItemAction and submits through submitProfessionalContributionAssessmentAction — never a direct service or Prisma call", () => {
  assert.match(source, /assessProfessionalContributionItemAction\(/);
  assert.match(source, /submitProfessionalContributionAssessmentAction\(/);
  assert.doesNotMatch(source, /from "@\/src\/lib\/prisma"/);
});

test("Ticket 25J §45: anchors are rendered as behavioral text, never a naked numeric scale, and points are never shown beside a choice", () => {
  assert.match(source, /anchor\.text/);
  assert.doesNotMatch(source, /\banchor\.points\b/);
});

test("Ticket 25J §20: the observation field only appears for an extreme (level 1 or 5) selection", () => {
  assert.match(source, /EXTREME_LEVELS/);
  assert.match(source, /EXTREME_LEVELS\.has\(level\)/);
});

test("radio selection from the item's own anchorsSnapshot, not a separate hardcoded five-point list", () => {
  assert.match(source, /type="radio"/);
  assert.match(source, /item\.anchorsSnapshot\.map\(/);
});

test("the submit control is disabled unless every trait has been assessed — no partial submission client-side", () => {
  assert.match(source, /allAssessed/);
  assert.match(source, /disabled=\{submitting \|\| !allAssessed\}/);
});

test("Ticket 25J §47: short bias-control guidance is shown while the draft is open, not a lecture", () => {
  assert.match(source, /Évaluez l.ensemble de la période/);
});

test("no client-supplied awardedPoints/score is ever sent — only level and observation are submitted for an item", () => {
  assert.doesNotMatch(source, /awardedPoints:\s*\d/);
});
