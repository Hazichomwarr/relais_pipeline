import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "prisma/migrations/20260809202040_add_daily_report_template_data/migration.sql",
  "utf8",
);
const schema = readFileSync("prisma/schema.prisma", "utf8");

test("daily report template data migration only adds one nullable JSONB column to DailyReport", () => {
  assert.match(
    migration,
    /ALTER TABLE "DailyReport" ADD COLUMN\s+"templateData" JSONB;/,
  );
  assert.doesNotMatch(migration, /NOT NULL/);
  assert.doesNotMatch(migration, /DROP\s+(TABLE|COLUMN|TYPE)/i);
  assert.doesNotMatch(migration, /UPDATE\s+"/i);
  assert.doesNotMatch(migration, /DELETE\s+FROM/i);
  assert.doesNotMatch(migration, /CREATE TABLE/i);
  assert.doesNotMatch(migration, /CREATE TYPE/i);

  const alterTableStatements = migration.match(/ALTER TABLE "[^"]+"[^;]*;/g) ?? [];
  assert.equal(alterTableStatements.length, 1);
});

test("templateData is nullable — pre-19B reports and brand-new drafts have none yet", () => {
  const modelMatch = schema.match(/model DailyReport \{[\s\S]*?\n\}/);
  assert.ok(modelMatch, "DailyReport model not found in schema");
  assert.match(modelMatch[0], /templateData\s+Json\?/);
});
