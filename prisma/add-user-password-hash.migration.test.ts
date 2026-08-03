import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "prisma/migrations/20260803192405_add_user_password_hash/migration.sql",
  "utf8",
);
const schema = readFileSync("prisma/schema.prisma", "utf8");

test("password hash migration is additive and leaves existing user data untouched", () => {
  assert.match(migration, /ADD COLUMN\s+"passwordHash" TEXT;/);
  assert.doesNotMatch(migration, /UPDATE\s+"User"/i);
  assert.doesNotMatch(migration, /DROP\s+(TABLE|COLUMN)/i);
  assert.doesNotMatch(migration, /DELETE\s+FROM/i);
});

test("passwordHash remains nullable so historical users are unaffected until a password is set", () => {
  assert.match(schema, /passwordHash\s+String\?/);
});
