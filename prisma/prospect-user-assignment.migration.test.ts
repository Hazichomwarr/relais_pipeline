import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "prisma/migrations/20260803180000_add_prospect_user_assignment/migration.sql",
  "utf8",
);
const schema = readFileSync("prisma/schema.prisma", "utf8");

test("assignment migration is additive and leaves existing ownership data untouched", () => {
  assert.match(
    migration,
    /ADD COLUMN "assignedUserId" TEXT;/,
  );
  assert.doesNotMatch(migration, /UPDATE\s+"Prospect"/i);
  assert.doesNotMatch(migration, /DROP\s+(TABLE|COLUMN)/i);
  assert.doesNotMatch(migration, /DELETE\s+FROM/i);
  assert.match(schema, /agentName\s+String/);
});

test("assignedUserId remains nullable and indexed", () => {
  assert.match(schema, /assignedUserId\s+String\?/);
  assert.match(schema, /@@index\(\[assignedUserId\]\)/);
});

test("deleting a User sets the relation to null rather than deleting Prospects", () => {
  assert.match(migration, /ON DELETE SET NULL/);
  assert.doesNotMatch(
    migration,
    /REFERENCES "User"\("id"\) ON DELETE CASCADE/,
  );
});
