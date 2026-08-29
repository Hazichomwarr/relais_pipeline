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

test("Ticket 25O §11/§15: the delete control is gated by canDeleteStructuredEvaluationDraft — ADMIN-only, never on a SUBMITTED assessment regardless of role", () => {
  assert.match(source, /const isDraft = assessment\.status === "DRAFT";/);
  assert.match(
    source,
    /const canDelete =\s*\n\s*isDraft && canDeleteStructuredEvaluationDraft\(actor\);/,
  );
  assert.match(source, /\{canDelete \? \(/);
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

const actionColumn = source.match(
  /return \(\s*\n\s*<div className="flex items-center gap-3">([\s\S]*?)\n {22}<\/div>/,
);

test("Ticket 25O §12/§14/§23: a DRAFT row's primary action is Continuer l’évaluation only when canMutateOwnedStructuredEvaluation is true (this viewer is the current, authorized recorded evaluator) — never merely because the row is a draft", () => {
  assert.match(
    source,
    /const canContinue =\s*\n\s*isDraft &&\s*\n\s*canMutateOwnedStructuredEvaluation\(\s*\n\s*actor,\s*\n\s*assessment\.evaluatorUserId,\s*\n\s*\);/,
  );
  assert.ok(actionColumn, "expected the action column block to be found");
  const continueBranch = actionColumn![1].match(
    /\{canContinue \? \(([\s\S]*?)\) : \(/,
  );
  assert.ok(continueBranch, "expected a canContinue branch in the action column");
  assert.match(continueBranch![1], /Continuer l’évaluation/);
  assert.match(
    continueBranch![1],
    /href=\{`\/admin\/performance-assessments\/professional-contribution\/\$\{assessment\.id\}`\}/,
  );
  assert.match(continueBranch![1], /bg-\[#0f2557\]/);
});

test("Ticket 25O §14/§25: whenever this viewer cannot continue the assessment (SUBMITTED, a legacy Manager draft, or another evaluator's draft), the row shows Voir le détail — never Continuer, never hidden entirely", () => {
  assert.ok(actionColumn, "expected the action column block to be found");
  const viewBranch = actionColumn![1].match(/\) : \(([\s\S]*?)\)\}/);
  assert.ok(viewBranch, "expected an else branch in the action column");
  assert.match(viewBranch![1], /Voir le détail/);
});
