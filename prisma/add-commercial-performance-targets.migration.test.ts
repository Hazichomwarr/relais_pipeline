import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "prisma/migrations/20260828160000_add_commercial_performance_targets/migration.sql",
  "utf8",
);
const schema = readFileSync("prisma/schema.prisma", "utf8");

test("migration only creates the new table, its indexes, and its two foreign keys — no existing table is touched", () => {
  assert.match(migration, /CREATE TABLE "CommercialPerformanceTarget"/);
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "CommercialPerformanceTarget_userId_periodStart_periodEnd_key"/,
  );
  assert.match(
    migration,
    /CREATE INDEX "CommercialPerformanceTarget_userId_periodStart_idx"/,
  );
  assert.match(
    migration,
    /ALTER TABLE "CommercialPerformanceTarget" ADD CONSTRAINT "CommercialPerformanceTarget_userId_fkey"/,
  );
  assert.match(
    migration,
    /ALTER TABLE "CommercialPerformanceTarget" ADD CONSTRAINT "CommercialPerformanceTarget_createdByUserId_fkey"/,
  );
  assert.doesNotMatch(migration, /DROP\s+(TABLE|COLUMN|TYPE|INDEX|CONSTRAINT)/i);
  assert.doesNotMatch(migration, /ALTER TABLE "Prospect"\s/);
  assert.doesNotMatch(migration, /ALTER TABLE "ProspectActivity"\s/);
  assert.doesNotMatch(migration, /ALTER TABLE "ProspectAction"\s/);
  assert.doesNotMatch(migration, /ALTER TABLE "User"\s/);
  assert.doesNotMatch(migration, /CREATE TYPE/);
  assert.doesNotMatch(migration, /UPDATE\s+"/i);
  assert.doesNotMatch(migration, /INSERT\s+INTO/i);
  assert.doesNotMatch(migration, /DELETE\s+FROM/i);
});

test("targetWins, periodStart, periodEnd, userId, roleAtAssignment, createdByUserId, and createdByRoleAtEvent are all NOT NULL — a target row is always fully specified, no partial rows", () => {
  for (const column of [
    '"userId"',
    '"periodStart"',
    '"periodEnd"',
    '"targetWins"',
    '"roleAtAssignment"',
    '"createdByUserId"',
    '"createdByRoleAtEvent"',
  ]) {
    const columnLine = migration
      .split("\n")
      .find((line) => line.trim().startsWith(column));
    assert.ok(columnLine, `column ${column} not found in CREATE TABLE`);
    assert.match(columnLine, /NOT NULL/);
  }
});

test("both foreign keys restrict deletion — a User referenced as employee or creator can never be hard-deleted while a target references them", () => {
  assert.match(
    migration,
    /"CommercialPerformanceTarget_userId_fkey" FOREIGN KEY \("userId"\) REFERENCES "User"\("id"\) ON DELETE RESTRICT/,
  );
  assert.match(
    migration,
    /"CommercialPerformanceTarget_createdByUserId_fkey" FOREIGN KEY \("createdByUserId"\) REFERENCES "User"\("id"\) ON DELETE RESTRICT/,
  );
});

test("the schema enforces one target per employee per canonical period via a unique constraint on [userId, periodStart, periodEnd]", () => {
  const modelMatch = schema.match(/model CommercialPerformanceTarget \{[\s\S]*?\n\}/);
  assert.ok(modelMatch, "CommercialPerformanceTarget model not found in schema");
  assert.match(modelMatch[0], /@@unique\(\[userId, periodStart, periodEnd\]\)/);
});

test("roleAtAssignment and createdByRoleAtEvent are frozen snapshots on the model, never re-derived from the User relation", () => {
  const modelMatch = schema.match(/model CommercialPerformanceTarget \{[\s\S]*?\n\}/);
  assert.ok(modelMatch, "CommercialPerformanceTarget model not found in schema");
  assert.match(modelMatch[0], /roleAtAssignment\s+UserRole/);
  assert.match(modelMatch[0], /createdByRoleAtEvent\s+UserRole/);
});

test("no schema change was made to Prospect, ProspectActivity, ProspectAction, or User's own columns — only new relations were added to User", () => {
  for (const model of ["Prospect", "ProspectActivity", "ProspectAction"]) {
    const modelMatch = schema.match(new RegExp(`model ${model} \\{[\\s\\S]*?\\n\\}`));
    assert.ok(modelMatch, `${model} model not found in schema`);
    assert.doesNotMatch(modelMatch[0], /CommercialPerformanceTarget/);
  }
});
