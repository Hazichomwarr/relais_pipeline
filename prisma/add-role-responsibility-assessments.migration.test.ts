import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "prisma/migrations/20260828180000_add_role_responsibility_assessments/migration.sql",
  "utf8",
);
const schema = readFileSync("prisma/schema.prisma", "utf8");

test("migration only creates the three new enums, two new tables, their indexes, and three foreign keys — no existing table is touched", () => {
  assert.match(migration, /CREATE TYPE "RoleResponsibilityAssessmentStatus"/);
  assert.match(migration, /CREATE TYPE "RoleResponsibilityAssessmentLevel"/);
  assert.match(migration, /CREATE TYPE "RoleResponsibilityEvidenceType"/);
  assert.match(migration, /CREATE TABLE "RoleResponsibilityAssessment"/);
  assert.match(migration, /CREATE TABLE "RoleResponsibilityAssessmentItem"/);
  assert.doesNotMatch(migration, /DROP\s+(TABLE|COLUMN|TYPE|INDEX|CONSTRAINT)/i);
  assert.doesNotMatch(migration, /ALTER TABLE "Prospect"\s/);
  assert.doesNotMatch(migration, /ALTER TABLE "ProspectActivity"\s/);
  assert.doesNotMatch(migration, /ALTER TABLE "ProspectAction"\s/);
  assert.doesNotMatch(migration, /ALTER TABLE "DailyReport"\s/);
  assert.doesNotMatch(migration, /ALTER TABLE "CommercialPerformanceTarget"\s/);
  assert.doesNotMatch(migration, /ALTER TABLE "User"\s/);
  assert.doesNotMatch(migration, /UPDATE\s+"/i);
  assert.doesNotMatch(migration, /INSERT\s+INTO/i);
  assert.doesNotMatch(migration, /DELETE\s+FROM/i);
});

test("RoleResponsibilityAssessmentStatus is exactly DRAFT, SUBMITTED", () => {
  assert.match(
    migration,
    /CREATE TYPE "RoleResponsibilityAssessmentStatus" AS ENUM \('DRAFT', 'SUBMITTED'\);/,
  );
});

test("RoleResponsibilityAssessmentLevel is exactly the four ordered levels", () => {
  assert.match(
    migration,
    /CREATE TYPE "RoleResponsibilityAssessmentLevel" AS ENUM \('NOT_MET', 'PARTIALLY_MET', 'MET', 'EXCEEDED'\);/,
  );
});

test("assessmentLevel, awardedPoints, and observation are nullable — an item may be legitimately UNASSESSED", () => {
  const itemTableMatch = migration.match(
    /CREATE TABLE "RoleResponsibilityAssessmentItem" \(([\s\S]*?)\);/,
  );
  assert.ok(itemTableMatch, "RoleResponsibilityAssessmentItem CREATE TABLE not found");
  const body = itemTableMatch[1];

  assert.doesNotMatch(body, /"assessmentLevel"[^,]*NOT NULL/);
  assert.doesNotMatch(body, /"awardedPoints"[^,]*NOT NULL/);
  assert.doesNotMatch(body, /"observation"[^,]*NOT NULL/);
});

test("score is nullable on the assessment (null until submission), maxScore defaults to 20", () => {
  const assessmentTableMatch = migration.match(
    /CREATE TABLE "RoleResponsibilityAssessment" \(([\s\S]*?)\);/,
  );
  assert.ok(assessmentTableMatch, "RoleResponsibilityAssessment CREATE TABLE not found");
  const body = assessmentTableMatch[1];

  assert.doesNotMatch(body, /"score"[^,]*NOT NULL/);
  assert.match(body, /"maxScore" INTEGER NOT NULL DEFAULT 20/);
});

test("every foreign key restricts or cascades correctly: employee/evaluator Restrict, items Cascade from their assessment only", () => {
  assert.match(
    migration,
    /"RoleResponsibilityAssessment_employeeUserId_fkey" FOREIGN KEY \("employeeUserId"\) REFERENCES "User"\("id"\) ON DELETE RESTRICT/,
  );
  assert.match(
    migration,
    /"RoleResponsibilityAssessment_evaluatorUserId_fkey" FOREIGN KEY \("evaluatorUserId"\) REFERENCES "User"\("id"\) ON DELETE RESTRICT/,
  );
  assert.match(
    migration,
    /"RoleResponsibilityAssessmentItem_assessmentId_fkey" FOREIGN KEY \("assessmentId"\) REFERENCES "RoleResponsibilityAssessment"\("id"\) ON DELETE CASCADE/,
  );
});

test("one assessment per employee per exact period, one item per responsibility per assessment — both enforced by unique constraints", () => {
  assert.match(migration, /CREATE UNIQUE INDEX "RoleResponsibilityAssessment_employeeUserId_periodStart_p_key"/);
  assert.match(migration, /CREATE UNIQUE INDEX "RoleResponsibilityAssessmentItem_assessmentId_responsibil_key"/);

  const assessmentModel = schema.match(/model RoleResponsibilityAssessment \{[\s\S]*?\n\}/);
  const itemModel = schema.match(/model RoleResponsibilityAssessmentItem \{[\s\S]*?\n\}/);
  assert.ok(assessmentModel);
  assert.ok(itemModel);
  assert.match(assessmentModel[0], /@@unique\(\[employeeUserId, periodStart, periodEnd\]\)/);
  assert.match(itemModel[0], /@@unique\(\[assessmentId, responsibilityKey\]\)/);
});

test("roleAtEvaluation and evaluatorRoleAtEvent are frozen snapshots on the schema, never re-derived from the User relation", () => {
  const assessmentModel = schema.match(/model RoleResponsibilityAssessment \{[\s\S]*?\n\}/);
  assert.ok(assessmentModel);
  assert.match(assessmentModel[0], /roleAtEvaluation\s+UserRole/);
  assert.match(assessmentModel[0], /evaluatorRoleAtEvent\s+UserRole/);
});

test("anchorsSnapshot is a JSON column on the item — the full catalog definition is frozen per item, not referenced by key alone", () => {
  const itemModel = schema.match(/model RoleResponsibilityAssessmentItem \{[\s\S]*?\n\}/);
  assert.ok(itemModel);
  assert.match(itemModel[0], /anchorsSnapshot\s+Json/);
  assert.match(itemModel[0], /labelAtEvaluation\s+String/);
  assert.match(itemModel[0], /descriptionAtEvaluation\s+String/);
});
