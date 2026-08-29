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
  assert.match(
    source,
    /disabled=\{submitting \|\| savingDraft \|\| !allAssessed\}/,
  );
});

test("Ticket 25J §47: short bias-control guidance is shown while the draft is open, not a lecture", () => {
  assert.match(source, /Évaluez l.ensemble de la période/);
});

test("no client-supplied awardedPoints/score is ever sent — only level and observation are submitted for an item", () => {
  assert.doesNotMatch(source, /awardedPoints:\s*\d/);
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

test("Ticket 25K.2 §57: saving a draft is a strictly separate call path from submission — handleSaveDraft never calls submitProfessionalContributionAssessmentAction", () => {
  const handleSaveDraftBody = source.match(
    /async function handleSaveDraft\(\) \{[\s\S]*?\n  \}/,
  );
  assert.ok(handleSaveDraftBody, "expected a handleSaveDraft function body");
  assert.doesNotMatch(
    handleSaveDraftBody![0],
    /submitProfessionalContributionAssessmentAction/,
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
