import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "prisma/migrations/20260829120000_add_assistant_user_role/migration.sql",
  "utf8",
);
const schema = readFileSync("prisma/schema.prisma", "utf8");

test("migration only adds one enum value to UserRole — no table creation, no column change, no drops, no data rewrite", () => {
  assert.match(migration, /ALTER TYPE "UserRole" ADD VALUE 'ASSISTANT';/);
  assert.doesNotMatch(migration, /DROP\s+(TABLE|COLUMN|TYPE|INDEX|CONSTRAINT)/i);
  assert.doesNotMatch(migration, /CREATE TABLE/i);
  assert.doesNotMatch(migration, /ALTER TABLE/i);
  assert.doesNotMatch(migration, /UPDATE\s+"/i);
  assert.doesNotMatch(migration, /INSERT\s+INTO/i);
  assert.doesNotMatch(migration, /DELETE\s+FROM/i);
});

test("Ticket 25M §3: the migration touches only UserRole — no other enum is altered in the same file", () => {
  const alterEnumStatements = migration.match(/ALTER TYPE "\w+"/g) ?? [];
  assert.deepEqual(alterEnumStatements, ['ALTER TYPE "UserRole"']);
});

test("UserRole in the schema contains exactly four values: ADMIN, ASSISTANT, COMMERCIAL, MANAGER", () => {
  const userRoleEnum = schema.match(/enum UserRole \{([\s\S]*?)\n\}/);
  assert.ok(userRoleEnum, "UserRole enum not found in schema");

  const values = userRoleEnum[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("//"));

  assert.deepEqual(values, ["ADMIN", "ASSISTANT", "COMMERCIAL", "MANAGER"]);
});
