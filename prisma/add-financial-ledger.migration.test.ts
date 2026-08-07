import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "prisma/migrations/20260807011048_add_financial_ledger/migration.sql",
  "utf8",
);
const schema = readFileSync("prisma/schema.prisma", "utf8");

test("financial ledger migration only adds new enums, a new table, indexes, and foreign keys", () => {
  assert.match(migration, /CREATE TYPE "LedgerEntryType"/);
  assert.match(migration, /CREATE TYPE "LedgerEntryStatus"/);
  assert.match(migration, /CREATE TYPE "PaymentMethod"/);
  assert.match(migration, /CREATE TYPE "LedgerEntryCategory"/);
  assert.match(migration, /CREATE TABLE "LedgerEntry"/);
  assert.doesNotMatch(migration, /DROP\s+(TABLE|COLUMN|TYPE)/i);
  assert.doesNotMatch(migration, /ALTER TABLE "User"/);
  assert.doesNotMatch(migration, /ALTER TABLE "Prospect"/);
  assert.doesNotMatch(migration, /UPDATE\s+"/i);
  assert.doesNotMatch(migration, /DELETE\s+FROM/i);
});

test("LedgerEntry foreign keys restrict deletion of referenced users and reversed entries", () => {
  assert.match(
    migration,
    /"LedgerEntry_createdByUserId_fkey" FOREIGN KEY \("createdByUserId"\) REFERENCES "User"\("id"\) ON DELETE RESTRICT/,
  );
  assert.match(
    migration,
    /"LedgerEntry_reversalOfId_fkey" FOREIGN KEY \("reversalOfId"\) REFERENCES "LedgerEntry"\("id"\) ON DELETE RESTRICT/,
  );
});

test("reversalOfId is unique, so at most one reversal can ever link to a given original entry", () => {
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "LedgerEntry_reversalOfId_key" ON "LedgerEntry"\("reversalOfId"\);/,
  );
});

test("amount is stored as a fixed-precision Decimal, never a float", () => {
  assert.match(schema, /amount\s+Decimal\s+@db\.Decimal\(18,\s*2\)/);
});

test("no persisted running balance field exists on LedgerEntry", () => {
  const modelMatch = schema.match(/model LedgerEntry \{[\s\S]*?\n\}/);
  assert.ok(modelMatch, "LedgerEntry model not found in schema");
  assert.doesNotMatch(modelMatch[0], /currentBalance|runningBalance|balance\s+Decimal/i);
});
