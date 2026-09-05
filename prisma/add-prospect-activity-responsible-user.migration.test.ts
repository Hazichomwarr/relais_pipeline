import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "prisma/migrations/20260905153021_add_prospect_activity_responsible_user/migration.sql",
  "utf8",
);
const schema = readFileSync("prisma/schema.prisma", "utf8");

test("migration only adds one nullable column, one index, and one FK on ProspectActivity — no drops, no data rewrite", () => {
  assert.match(
    migration,
    /ALTER TABLE "ProspectActivity" ADD COLUMN\s+"responsibleUserIdAtEvent"/,
  );
  assert.match(
    migration,
    /CREATE INDEX "ProspectActivity_responsibleUserIdAtEvent_occurredAt_idx"/,
  );
  assert.match(
    migration,
    /ALTER TABLE "ProspectActivity" ADD CONSTRAINT "ProspectActivity_responsibleUserIdAtEvent_fkey"/,
  );
  assert.doesNotMatch(migration, /DROP\s+(TABLE|COLUMN|TYPE|INDEX|CONSTRAINT)/i);
  assert.doesNotMatch(migration, /ALTER TABLE "Prospect"\s/);
  assert.doesNotMatch(migration, /ALTER TABLE "User"/);
  assert.doesNotMatch(migration, /CREATE TYPE/);
  assert.doesNotMatch(migration, /UPDATE\s+"/i);
  assert.doesNotMatch(migration, /INSERT\s+INTO/i);
  assert.doesNotMatch(migration, /DELETE\s+FROM/i);
});

test("the new ProspectActivity column is nullable — no backfill is required or possible", () => {
  assert.doesNotMatch(migration, /"responsibleUserIdAtEvent"[^,;]*NOT NULL/);
});

test("the new foreign key restricts deletion — a historically-responsible User can never be hard-deleted while an activity references them", () => {
  assert.match(
    migration,
    /"ProspectActivity_responsibleUserIdAtEvent_fkey" FOREIGN KEY \("responsibleUserIdAtEvent"\) REFERENCES "User"\("id"\) ON DELETE RESTRICT/,
  );
});

test("responsibility lives on ProspectActivity, not as a new field on Prospect — it is a per-event historical fact, not current state", () => {
  const prospectModelMatch = schema.match(/model Prospect \{[\s\S]*?\n\}/);
  assert.ok(prospectModelMatch, "Prospect model not found in schema");
  assert.doesNotMatch(prospectModelMatch[0], /responsibleUser/);

  const activityModelMatch = schema.match(/model ProspectActivity \{[\s\S]*?\n\}/);
  assert.ok(activityModelMatch, "ProspectActivity model not found in schema");
  assert.match(activityModelMatch[0], /responsibleUserIdAtEvent\s+String\?/);
});

test("responsibleUserIdAtEvent is a distinct relation from creditedUserId and agentName — three separate historical concepts on the same model", () => {
  const activityModelMatch = schema.match(/model ProspectActivity \{[\s\S]*?\n\}/);
  assert.ok(activityModelMatch, "ProspectActivity model not found in schema");
  assert.match(activityModelMatch[0], /agentName\s+String\?/);
  assert.match(
    activityModelMatch[0],
    /creditedUser\s+User\?\s+@relation\("ProspectActivityCreditedUser"/,
  );
  assert.match(
    activityModelMatch[0],
    /responsibleUserAtEvent\s+User\?\s+@relation\("ProspectActivityResponsibleUser"/,
  );
});
