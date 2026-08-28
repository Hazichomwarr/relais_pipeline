import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "prisma/migrations/20260828140000_add_won_result_attribution/migration.sql",
  "utf8",
);
const schema = readFileSync("prisma/schema.prisma", "utf8");

test("migration only adds three nullable columns, one index, and one FK on ProspectActivity — no drops, no data rewrite", () => {
  assert.match(
    migration,
    /ALTER TABLE "ProspectActivity" ADD COLUMN\s+"creditedUserId"/,
  );
  assert.match(migration, /ADD COLUMN\s+"creditedUserNameAtEvent"/);
  assert.match(migration, /ADD COLUMN\s+"creditedUserRoleAtEvent"/);
  assert.match(
    migration,
    /CREATE INDEX "ProspectActivity_creditedUserId_occurredAt_idx"/,
  );
  assert.match(
    migration,
    /ALTER TABLE "ProspectActivity" ADD CONSTRAINT "ProspectActivity_creditedUserId_fkey"/,
  );
  assert.doesNotMatch(migration, /DROP\s+(TABLE|COLUMN|TYPE|INDEX|CONSTRAINT)/i);
  assert.doesNotMatch(migration, /ALTER TABLE "Prospect"\s/);
  assert.doesNotMatch(migration, /ALTER TABLE "User"/);
  assert.doesNotMatch(migration, /CREATE TYPE/);
  assert.doesNotMatch(migration, /UPDATE\s+"/i);
  assert.doesNotMatch(migration, /INSERT\s+INTO/i);
  assert.doesNotMatch(migration, /DELETE\s+FROM/i);
});

test("the new ProspectActivity columns are nullable — no backfill is required or possible", () => {
  assert.doesNotMatch(migration, /"creditedUserId"[^,]*NOT NULL/);
  assert.doesNotMatch(migration, /"creditedUserNameAtEvent"[^,]*NOT NULL/);
  assert.doesNotMatch(migration, /"creditedUserRoleAtEvent"[^,]*NOT NULL/);
});

test("the new foreign key restricts deletion — a credited User can never be hard-deleted while a WON event references them", () => {
  assert.match(
    migration,
    /"ProspectActivity_creditedUserId_fkey" FOREIGN KEY \("creditedUserId"\) REFERENCES "User"\("id"\) ON DELETE RESTRICT/,
  );
});

test("attribution lives on ProspectActivity, not as a new field on Prospect — credit is a per-event historical fact, not current state", () => {
  const prospectModelMatch = schema.match(/model Prospect \{[\s\S]*?\n\}/);
  assert.ok(prospectModelMatch, "Prospect model not found in schema");
  assert.doesNotMatch(prospectModelMatch[0], /creditedUser/);

  const activityModelMatch = schema.match(/model ProspectActivity \{[\s\S]*?\n\}/);
  assert.ok(activityModelMatch, "ProspectActivity model not found in schema");
  assert.match(activityModelMatch[0], /creditedUserId\s+String\?/);
  assert.match(activityModelMatch[0], /creditedUserNameAtEvent\s+String\?/);
  assert.match(activityModelMatch[0], /creditedUserRoleAtEvent\s+UserRole\?/);
});

test("creditedUserId is a distinct relation from agentName — the actor and the credited employee remain separate concepts in the schema", () => {
  const activityModelMatch = schema.match(/model ProspectActivity \{[\s\S]*?\n\}/);
  assert.ok(activityModelMatch, "ProspectActivity model not found in schema");
  assert.match(activityModelMatch[0], /agentName\s+String\?/);
  assert.match(
    activityModelMatch[0],
    /creditedUser\s+User\?\s+@relation\("ProspectActivityCreditedUser"/,
  );
});
