import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "prisma/migrations/20260828200000_add_professional_contribution_assessments/migration.sql",
  "utf8",
);
const schema = readFileSync("prisma/schema.prisma", "utf8");

test("migration only creates the new enum, two new tables, their indexes, and three foreign keys — no existing table is touched", () => {
  assert.match(migration, /CREATE TYPE "ProfessionalContributionAssessmentStatus"/);
  assert.match(migration, /CREATE TABLE "ProfessionalContributionAssessment"/);
  assert.match(migration, /CREATE TABLE "ProfessionalContributionAssessmentItem"/);
  assert.doesNotMatch(migration, /DROP\s+(TABLE|COLUMN|TYPE|INDEX|CONSTRAINT)/i);
  assert.doesNotMatch(migration, /ALTER TABLE "Prospect"\s/);
  assert.doesNotMatch(migration, /ALTER TABLE "ProspectActivity"\s/);
  assert.doesNotMatch(migration, /ALTER TABLE "ProspectAction"\s/);
  assert.doesNotMatch(migration, /ALTER TABLE "DailyReport"\s/);
  assert.doesNotMatch(migration, /ALTER TABLE "CommercialPerformanceTarget"\s/);
  assert.doesNotMatch(migration, /ALTER TABLE "RoleResponsibilityAssessment"\s/);
  assert.doesNotMatch(migration, /ALTER TABLE "RoleResponsibilityAssessmentItem"\s/);
  assert.doesNotMatch(migration, /ALTER TABLE "User"\s/);
  assert.doesNotMatch(migration, /UPDATE\s+"/i);
  assert.doesNotMatch(migration, /INSERT\s+INTO/i);
  assert.doesNotMatch(migration, /DELETE\s+FROM/i);
});

test("ProfessionalContributionAssessmentStatus is exactly DRAFT, SUBMITTED — a separate enum from RoleResponsibilityAssessmentStatus", () => {
  assert.match(
    migration,
    /CREATE TYPE "ProfessionalContributionAssessmentStatus" AS ENUM \('DRAFT', 'SUBMITTED'\);/,
  );
});

test("selectedLevel, awardedPoints, and observation are nullable — an item may be legitimately UNASSESSED", () => {
  const itemTableMatch = migration.match(
    /CREATE TABLE "ProfessionalContributionAssessmentItem" \(([\s\S]*?)\);/,
  );
  assert.ok(itemTableMatch, "ProfessionalContributionAssessmentItem CREATE TABLE not found");
  const body = itemTableMatch[1];

  assert.doesNotMatch(body, /"selectedLevel"[^,]*NOT NULL/);
  assert.doesNotMatch(body, /"awardedPoints"[^,]*NOT NULL/);
  assert.doesNotMatch(body, /"observation"[^,]*NOT NULL/);
});

test("awardedPoints is a floating-point column, not an integer — the proportional per-trait formula produces fractional intermediate values", () => {
  assert.match(migration, /"awardedPoints" DOUBLE PRECISION/);
});

test("score is nullable on the assessment (null until submission), maxScore defaults to 10", () => {
  const assessmentTableMatch = migration.match(
    /CREATE TABLE "ProfessionalContributionAssessment" \(([\s\S]*?)\);/,
  );
  assert.ok(assessmentTableMatch, "ProfessionalContributionAssessment CREATE TABLE not found");
  const body = assessmentTableMatch[1];

  assert.doesNotMatch(body, /"score"[^,]*NOT NULL/);
  assert.match(body, /"maxScore" INTEGER NOT NULL DEFAULT 10/);
});

test("score itself stays an integer — only the final total is stored, not a fractional value", () => {
  const assessmentTableMatch = migration.match(
    /CREATE TABLE "ProfessionalContributionAssessment" \(([\s\S]*?)\);/,
  );
  assert.ok(assessmentTableMatch);
  assert.match(assessmentTableMatch[1], /"score" INTEGER/);
});

test("every foreign key restricts or cascades correctly: employee/evaluator Restrict, items Cascade from their assessment only", () => {
  assert.match(
    migration,
    /"ProfessionalContributionAssessment_employeeUserId_fkey" FOREIGN KEY \("employeeUserId"\) REFERENCES "User"\("id"\) ON DELETE RESTRICT/,
  );
  assert.match(
    migration,
    /"ProfessionalContributionAssessment_evaluatorUserId_fkey" FOREIGN KEY \("evaluatorUserId"\) REFERENCES "User"\("id"\) ON DELETE RESTRICT/,
  );
  assert.match(
    migration,
    /"ProfessionalContributionAssessmentItem_assessmentId_fkey" FOREIGN KEY \("assessmentId"\) REFERENCES "ProfessionalContributionAssessment"\("id"\) ON DELETE CASCADE/,
  );
});

test("one assessment per employee per exact period, one item per trait per assessment — both enforced by unique constraints", () => {
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "ProfessionalContributionAssessment_employeeUserId_periodSt_key"/,
  );
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "ProfessionalContributionAssessmentItem_assessmentId_traitK_key"/,
  );

  const assessmentModel = schema.match(/model ProfessionalContributionAssessment \{[\s\S]*?\n\}/);
  const itemModel = schema.match(/model ProfessionalContributionAssessmentItem \{[\s\S]*?\n\}/);
  assert.ok(assessmentModel);
  assert.ok(itemModel);
  assert.match(assessmentModel[0], /@@unique\(\[employeeUserId, periodStart, periodEnd\]\)/);
  assert.match(itemModel[0], /@@unique\(\[assessmentId, traitKey\]\)/);
});

test("roleAtEvaluation and evaluatorRoleAtEvent are frozen snapshots on the schema, never re-derived from the User relation", () => {
  const assessmentModel = schema.match(/model ProfessionalContributionAssessment \{[\s\S]*?\n\}/);
  assert.ok(assessmentModel);
  assert.match(assessmentModel[0], /roleAtEvaluation\s+UserRole/);
  assert.match(assessmentModel[0], /evaluatorRoleAtEvent\s+UserRole/);
});

test("anchorsSnapshot is a JSON column on the item — the full trait definition (all five anchors) is frozen per item, not referenced by key alone", () => {
  const itemModel = schema.match(/model ProfessionalContributionAssessmentItem \{[\s\S]*?\n\}/);
  assert.ok(itemModel);
  assert.match(itemModel[0], /anchorsSnapshot\s+Json/);
  assert.match(itemModel[0], /labelAtEvaluation\s+String/);
  assert.match(itemModel[0], /descriptionAtEvaluation\s+String/);
});

test("ProfessionalContributionAssessment is a model distinct from RoleResponsibilityAssessment — no cross-reference between the two", () => {
  const professionalModel = schema.match(/model ProfessionalContributionAssessment \{[\s\S]*?\n\}/);
  const professionalItemModel = schema.match(/model ProfessionalContributionAssessmentItem \{[\s\S]*?\n\}/);
  assert.ok(professionalModel);
  assert.ok(professionalItemModel);
  assert.doesNotMatch(professionalModel[0], /RoleResponsibility/);
  assert.doesNotMatch(professionalItemModel[0], /RoleResponsibility/);
});
