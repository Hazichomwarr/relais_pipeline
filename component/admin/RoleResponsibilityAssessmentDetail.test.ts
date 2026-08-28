import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  "component/admin/RoleResponsibilityAssessmentDetail.tsx",
  "utf8",
);

test("assesses items through assessRoleResponsibilityItemAction and submits through submitRoleResponsibilityAssessmentAction — never a direct service or Prisma call", () => {
  assert.match(source, /assessRoleResponsibilityItemAction\(/);
  assert.match(source, /submitRoleResponsibilityAssessmentAction\(/);
  assert.doesNotMatch(source, /from "@\/src\/lib\/prisma"/);
});

test("Ticket 25I §60: anchors are rendered as behavioral text, never a naked numeric scale", () => {
  assert.match(source, /anchor\.text/);
  assert.doesNotMatch(source, /\[1\]\s*\[2\]\s*\[3\]/);
});

test("Ticket 25I §35: the observation field only appears for an extreme (NOT_MET/EXCEEDED) selection, via isExtremeRoleResponsibilityLevel — never hardcoded per level", () => {
  assert.match(source, /isExtremeRoleResponsibilityLevel/);
});

test("radio selection, not a free-typed level — the four options come from the item's own anchorsSnapshot, not a separate hardcoded list", () => {
  assert.match(source, /type="radio"/);
  assert.match(source, /item\.anchorsSnapshot\.map\(/);
});

test("the submit control is disabled unless every item has been assessed — no partial submission client-side", () => {
  assert.match(source, /allAssessed/);
  assert.match(source, /disabled=\{submitting \|\| !allAssessed\}/);
});

test("the score tile only renders for a SUBMITTED assessment — a draft never shows a partial or fabricated number", () => {
  assert.match(source, /status === "SUBMITTED" \? \(/);
});

test("no client-supplied awardedPoints/score is ever sent — only level and observation are submitted for an item", () => {
  assert.doesNotMatch(source, /awardedPoints:\s*\d/);
});
