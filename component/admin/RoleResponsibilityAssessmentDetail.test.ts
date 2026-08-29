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
  assert.match(
    source,
    /disabled=\{submitting \|\| savingDraft \|\| !allAssessed\}/,
  );
});

test("the score tile only renders for a SUBMITTED (locked) assessment — a draft never shows a partial or fabricated number", () => {
  assert.match(source, /const locked = status === "SUBMITTED";/);
  assert.match(source, /\{locked \? \(/);
});

test("Ticket 25K.2 §13/§37: an explicit Enregistrer le brouillon action exists, distinct from submission, with its own confirmation", () => {
  assert.match(source, /Enregistrer le brouillon/);
  assert.match(source, /Brouillon enregistré\./);
  assert.match(source, /handleSaveDraft/);
});

test("Ticket 25K.2 §38: a distinct Évaluation soumise confirmation is shown right after submission", () => {
  assert.match(source, /Évaluation soumise\./);
  assert.match(source, /justSubmitted/);
});

test("Ticket 25K.2 §57: saving a draft is a strictly separate call path from submission — handleSaveDraft never calls submitRoleResponsibilityAssessmentAction", () => {
  const handleSaveDraftBody = source.match(
    /async function handleSaveDraft\(\) \{[\s\S]*?\n  \}/,
  );
  assert.ok(handleSaveDraftBody, "expected a handleSaveDraft function body");
  assert.doesNotMatch(
    handleSaveDraftBody![0],
    /submitRoleResponsibilityAssessmentAction/,
  );
});

test("Ticket 25K.2 §28/§29: rendering is gated by canEdit as well as SUBMITTED lock — a non-owning viewer sees a read-only draft with the evaluator's name, never editable controls", () => {
  assert.match(source, /canEdit/);
  assert.match(source, /const readOnly = locked \|\| !canEdit;/);
  assert.match(
    source,
    /Cette évaluation est en cours de rédaction par \{evaluatorName\}\./,
  );
});

test("no client-supplied awardedPoints/score is ever sent — only level and observation are submitted for an item", () => {
  assert.doesNotMatch(source, /awardedPoints:\s*\d/);
});
