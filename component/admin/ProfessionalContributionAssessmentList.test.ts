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

const actionColumn = source.match(
  /<div className="flex items-center gap-3">([\s\S]*?)\n {18}<\/div>/,
);

test("Ticket 25K.2 §6/§7: a DRAFT row's primary action is Continuer l’évaluation, linking to the canonical detail route, styled more prominently than Supprimer", () => {
  assert.ok(actionColumn, "expected the action column block to be found");
  const draftBranch = actionColumn![1].match(
    /assessment\.status === "DRAFT" \? \(([\s\S]*?)\) : \(/,
  );
  assert.ok(draftBranch, "expected a DRAFT branch in the action column");
  assert.match(draftBranch![1], /Continuer l’évaluation/);
  assert.match(
    draftBranch![1],
    /href=\{`\/admin\/performance-assessments\/professional-contribution\/\$\{assessment\.id\}`\}/,
  );
  assert.match(draftBranch![1], /bg-\[#0f2557\]/);
});

test("Ticket 25K.2 §8: a SUBMITTED row shows Voir le détail, with no delete/edit affordance", () => {
  assert.ok(actionColumn, "expected the action column block to be found");
  const submittedBranch = actionColumn![1].match(/\) : \(([\s\S]*?)\)\}/);
  assert.ok(submittedBranch, "expected a SUBMITTED branch in the action column");
  assert.match(submittedBranch![1], /Voir le détail/);
  assert.doesNotMatch(submittedBranch![1], /Supprimer/);
});
