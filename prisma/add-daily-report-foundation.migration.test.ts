import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "prisma/migrations/20260809195615_add_daily_report_foundation/migration.sql",
  "utf8",
);
const schema = readFileSync("prisma/schema.prisma", "utf8");

test("daily report foundation migration only adds new enums, a nullable User column, a new table, indexes, and a foreign key", () => {
  assert.match(
    migration,
    /CREATE TYPE "DailyReportTemplateType" AS ENUM \('ASSISTANT', 'OPERATIONS_COORDINATOR'\)/,
  );
  assert.match(
    migration,
    /CREATE TYPE "DailyReportStatus" AS ENUM \('DRAFT', 'SUBMITTED'\)/,
  );
  assert.match(migration, /CREATE TABLE "DailyReport"/);
  assert.doesNotMatch(migration, /DROP\s+(TABLE|COLUMN|TYPE)/i);
  assert.doesNotMatch(migration, /UPDATE\s+"/i);
  assert.doesNotMatch(migration, /DELETE\s+FROM/i);
});

test("the only change to an existing table is the nullable dailyReportTemplateType column on User", () => {
  const alterTableStatements = migration.match(/ALTER TABLE "[^"]+"[^;]*;/g) ?? [];

  assert.equal(alterTableStatements.length, 2);
  assert.match(
    alterTableStatements[0],
    /ALTER TABLE "User" ADD COLUMN\s+"dailyReportTemplateType" "DailyReportTemplateType";/,
  );
  assert.doesNotMatch(alterTableStatements[0], /NOT NULL/);
  assert.match(
    alterTableStatements[1],
    /ALTER TABLE "DailyReport" ADD CONSTRAINT/,
  );
});

test("DailyReport.ownerUserId foreign key restricts deletion of the owning user", () => {
  assert.match(
    migration,
    /"DailyReport_ownerUserId_fkey" FOREIGN KEY \("ownerUserId"\) REFERENCES "User"\("id"\) ON DELETE RESTRICT/,
  );
});

test("one report per employee per business date is enforced at the database level", () => {
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "DailyReport_ownerUserId_reportDate_key" ON "DailyReport"\("ownerUserId", "reportDate"\)/,
  );
});

test("accomplishedToday and plannedTomorrow are required text columns (not nullable)", () => {
  const createTableMatch = migration.match(/CREATE TABLE "DailyReport" \([\s\S]*?\);/);
  assert.ok(createTableMatch, "CREATE TABLE \"DailyReport\" statement not found");

  assert.match(createTableMatch[0], /"accomplishedToday" TEXT NOT NULL/);
  assert.match(createTableMatch[0], /"plannedTomorrow" TEXT NOT NULL/);
  assert.match(createTableMatch[0], /"submittedAt" TIMESTAMP\(3\)(?!\s+NOT NULL)/);
});

/**
 * Ticket 25M §5/§4 — before 25M, this test proved the two enums were
 * distinct by asserting UserRole contained neither of
 * DailyReportTemplateType's values at all. That's no longer true:
 * UserRole legitimately gained its own, unrelated ASSISTANT value in
 * 25M. The two enums still share nothing but a name collision on that
 * one string — proven here by (a) UserRole still never containing
 * OPERATIONS_COORDINATOR (the one DailyReportTemplateType value that
 * was never ambiguous), and (b) User.role and
 * User.dailyReportTemplateType being two separately-typed fields, so
 * Prisma/TypeScript itself treats "ASSISTANT the role" and "ASSISTANT
 * the report template" as values of unrelated types, never
 * interchangeable.
 */
test("UserRole and DailyReportTemplateType remain distinct domain concepts even though both now legitimately contain \"ASSISTANT\"", () => {
  const userRoleEnum = schema.match(/enum UserRole \{[\s\S]*?\n\}/);
  const templateTypeEnum = schema.match(/enum DailyReportTemplateType \{[\s\S]*?\n\}/);

  assert.ok(userRoleEnum, "UserRole enum not found in schema");
  assert.ok(templateTypeEnum, "DailyReportTemplateType enum not found in schema");

  assert.match(userRoleEnum[0], /ASSISTANT/);
  assert.doesNotMatch(userRoleEnum[0], /OPERATIONS_COORDINATOR/);
  assert.match(templateTypeEnum[0], /ASSISTANT/);
  assert.match(templateTypeEnum[0], /OPERATIONS_COORDINATOR/);

  const userModel = schema.match(/model User \{[\s\S]*?\n\}/);
  assert.ok(userModel, "User model not found in schema");
  assert.match(userModel[0], /\n\s*role\s+UserRole\s*\n/);
  assert.match(
    userModel[0],
    /\n\s*dailyReportTemplateType\s+DailyReportTemplateType\?\s*\n/,
  );
});

test("DailyReport has no field snapshotting the owner's display name — presentation resolves it via the live User relation", () => {
  const modelMatch = schema.match(/model DailyReport \{[\s\S]*?\n\}/);
  assert.ok(modelMatch, "DailyReport model not found in schema");
  assert.doesNotMatch(modelMatch[0], /firstName|lastName/);
});
