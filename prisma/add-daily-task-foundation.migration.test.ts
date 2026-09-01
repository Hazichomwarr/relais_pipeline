import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "prisma/migrations/20260901220000_add_daily_task_foundation/migration.sql",
  "utf8",
);
const schema = readFileSync("prisma/schema.prisma", "utf8");

test("migration only creates the DailyTaskStatus enum and the DailyTask table with its constraints/indexes — no existing table/type is touched, no data is inserted or backfilled", () => {
  assert.match(migration, /CREATE TYPE "DailyTaskStatus"/);
  assert.match(migration, /CREATE TABLE "DailyTask"/);
  assert.doesNotMatch(migration, /DROP\s+(TABLE|COLUMN|TYPE|INDEX|CONSTRAINT)/i);
  assert.doesNotMatch(migration, /ALTER TABLE "User"/);
  assert.doesNotMatch(migration, /ALTER TABLE "Workday"/);
  assert.doesNotMatch(migration, /ALTER TYPE/i);
  assert.doesNotMatch(migration, /UPDATE\s+"/i);
  assert.doesNotMatch(migration, /INSERT\s+INTO/i);
  assert.doesNotMatch(migration, /DELETE\s+FROM/i);

  const alterTableStatements = migration.match(/ALTER TABLE "\w+"/g) ?? [];
  assert.deepEqual(alterTableStatements, [
    'ALTER TABLE "DailyTask"',
    'ALTER TABLE "DailyTask"',
  ]);
});

test("DailyTaskStatus contains exactly OPEN, COMPLETED, CANCELLED", () => {
  assert.match(
    migration,
    /CREATE TYPE "DailyTaskStatus" AS ENUM \('OPEN', 'COMPLETED', 'CANCELLED'\);/,
  );

  const enumBlock = schema.match(/enum DailyTaskStatus \{([\s\S]*?)\n\}/);
  assert.ok(enumBlock, "DailyTaskStatus enum not found in schema");

  const values = enumBlock[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("//"));

  assert.deepEqual(values, ["OPEN", "COMPLETED", "CANCELLED"]);
});

test("assignedToUserId and assignedByUserId are Restrict foreign keys to User — no Cascade, no SetNull", () => {
  assert.match(
    migration,
    /"DailyTask_assignedToUserId_fkey" FOREIGN KEY \("assignedToUserId"\) REFERENCES "User"\("id"\) ON DELETE RESTRICT/,
  );
  assert.match(
    migration,
    /"DailyTask_assignedByUserId_fkey" FOREIGN KEY \("assignedByUserId"\) REFERENCES "User"\("id"\) ON DELETE RESTRICT/,
  );
  assert.doesNotMatch(migration, /DailyTask[\s\S]*ON DELETE (CASCADE|SET NULL)/i);
});

test("workDate, assignedToUserId, assignedByUserId, content, and assignedAt are all required", () => {
  assert.match(migration, /"workDate" TIMESTAMP\(3\) NOT NULL,/);
  assert.match(migration, /"assignedToUserId" TEXT NOT NULL,/);
  assert.match(migration, /"assignedByUserId" TEXT NOT NULL,/);
  assert.match(migration, /"content" TEXT NOT NULL,/);
  assert.match(migration, /"assignedAt" TIMESTAMP\(3\) NOT NULL,/);
});

test("status is required and defaults to OPEN", () => {
  assert.match(migration, /"status" "DailyTaskStatus" NOT NULL DEFAULT 'OPEN',/);

  const model = schema.match(/model DailyTask \{[\s\S]*?\n\}/);
  assert.ok(model, "DailyTask model not found");
  assert.match(model[0], /status\s+DailyTaskStatus\s+@default\(OPEN\)/);
});

test("completedAt and cancellationReason are nullable", () => {
  assert.match(migration, /"completedAt" TIMESTAMP\(3\),/);
  assert.match(migration, /"cancellationReason" TEXT,/);

  const model = schema.match(/model DailyTask \{[\s\S]*?\n\}/);
  assert.ok(model, "DailyTask model not found");
  assert.match(model[0], /completedAt\s+DateTime\?/);
  assert.match(model[0], /cancellationReason\s+String\?/);
});

test("no unique constraint on (assignedToUserId, workDate, content) — duplicate task text is allowed", () => {
  assert.doesNotMatch(migration, /CREATE UNIQUE INDEX "DailyTask/);

  const model = schema.match(/model DailyTask \{[\s\S]*?\n\}/);
  assert.ok(model, "DailyTask model not found");
  assert.doesNotMatch(model[0], /@@unique/);
});

test("no Workday relation, no organizationId, no Prospect/ProspectAction relation, no DailyReport relation, no Performance relation, no role snapshot, and no reassignment/cancellation-provenance fields beyond cancellationReason", () => {
  const model = schema.match(/model DailyTask \{([\s\S]*?)\n\}/);
  assert.ok(model, "DailyTask model not found");

  // Strip comment lines — the model's own explanatory comments legitimately
  // name these concepts while explaining why they're absent.
  const fieldsOnly = model[1]
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");

  assert.doesNotMatch(fieldsOnly, /workday/i);
  assert.doesNotMatch(fieldsOnly, /organizationId/);
  assert.doesNotMatch(fieldsOnly, /prospect/i);
  assert.doesNotMatch(fieldsOnly, /dailyReport/i);
  assert.doesNotMatch(fieldsOnly, /performance|executionScore|scoreWeight|points/i);
  assert.doesNotMatch(fieldsOnly, /RoleAtEvent|RoleAtAssignment|roleAt/i);
  assert.doesNotMatch(fieldsOnly, /previousAssignedTo|reassigned|cancelledAt|cancelledByUserId|completedByUserId/i);
  assert.doesNotMatch(fieldsOnly, /priority|category|estimatedHours|tags|attachments|comments|subtasks|recurrence|reminders|dueTime|location/i);
});

test("DailyTask has exactly the field set 27A/27D decided — nothing more", () => {
  const model = schema.match(/model DailyTask \{([\s\S]*?)\n\}/);
  assert.ok(model, "DailyTask model not found");

  const fieldLines = model[1]
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) => line.length > 0 && !line.startsWith("//") && !line.startsWith("@@"),
    );

  const fieldNames = fieldLines.map((line) => line.split(/\s+/)[0]);

  assert.deepEqual(fieldNames, [
    "id",
    "workDate",
    "assignedToUserId",
    "assignedTo",
    "assignedByUserId",
    "assignedBy",
    "content",
    "assignedAt",
    "status",
    "completedAt",
    "cancellationReason",
    "createdAt",
    "updatedAt",
  ]);
});

test("User gains exactly two new DailyTask relations, named for the two distinct roles a User can play", () => {
  const userModel = schema.match(/model User \{[\s\S]*?\n\}/);
  assert.ok(userModel, "User model not found");
  assert.match(
    userModel[0],
    /dailyTasksAssignedTo\s+DailyTask\[\]\s+@relation\("DailyTasksAssignedTo"\)/,
  );
  assert.match(
    userModel[0],
    /dailyTasksAssignedBy\s+DailyTask\[\]\s+@relation\("DailyTasksAssignedBy"\)/,
  );
});

test("query-supporting indexes exist: assignee+date, date alone, and assignor", () => {
  assert.match(
    migration,
    /CREATE INDEX "DailyTask_assignedToUserId_workDate_idx" ON "DailyTask"\("assignedToUserId", "workDate"\)/,
  );
  assert.match(
    migration,
    /CREATE INDEX "DailyTask_workDate_idx" ON "DailyTask"\("workDate"\)/,
  );
  assert.match(
    migration,
    /CREATE INDEX "DailyTask_assignedByUserId_idx" ON "DailyTask"\("assignedByUserId"\)/,
  );
});
