import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "prisma/migrations/20260808172015_add_shared_feed_foundation/migration.sql",
  "utf8",
);
const schema = readFileSync("prisma/schema.prisma", "utf8");

test("shared feed foundation migration only adds a new enum value, a new enum, a new table, indexes, and foreign keys", () => {
  assert.match(migration, /ALTER TYPE "ProspectActivityType" ADD VALUE 'WON_TRANSITION'/);
  assert.match(migration, /CREATE TYPE "UserStatusActivityType" AS ENUM \('ACTIVATED', 'DEACTIVATED'\)/);
  assert.match(migration, /CREATE TABLE "UserStatusActivity"/);
  assert.doesNotMatch(migration, /DROP\s+(TABLE|COLUMN|TYPE)/i);
  assert.doesNotMatch(migration, /ALTER TABLE "Prospect"/);
  assert.doesNotMatch(migration, /ALTER TABLE "User"\s/);
  assert.doesNotMatch(migration, /UPDATE\s+"/i);
  assert.doesNotMatch(migration, /DELETE\s+FROM/i);
});

test("UserStatusActivity foreign keys restrict deletion of the target and actor users", () => {
  assert.match(
    migration,
    /"UserStatusActivity_userId_fkey" FOREIGN KEY \("userId"\) REFERENCES "User"\("id"\) ON DELETE RESTRICT/,
  );
  assert.match(
    migration,
    /"UserStatusActivity_actorUserId_fkey" FOREIGN KEY \("actorUserId"\) REFERENCES "User"\("id"\) ON DELETE RESTRICT/,
  );
});

test("WON_TRANSITION is documented as system-generated only, never user-selectable", () => {
  const enumMatch = schema.match(/enum ProspectActivityType \{[\s\S]*?\n\}/);
  assert.ok(enumMatch, "ProspectActivityType enum not found in schema");
  assert.match(enumMatch[0], /system-generated only/i);
});

test("UserStatusActivity has no field for a role snapshot — presentation resolves the role via the live User relation", () => {
  const modelMatch = schema.match(/model UserStatusActivity \{[\s\S]*?\n\}/);
  assert.ok(modelMatch, "UserStatusActivity model not found in schema");
  assert.doesNotMatch(modelMatch[0], /role/i);
});
