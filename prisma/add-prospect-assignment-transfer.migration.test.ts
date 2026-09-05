import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "prisma/migrations/20260905160451_add_prospect_assignment_transfer/migration.sql",
  "utf8",
);
const schema = readFileSync("prisma/schema.prisma", "utf8");

test("migration only creates the ProspectAssignmentTransfer table, its indexes, and its FKs — no drops, no data rewrite, no existing table touched", () => {
  assert.match(migration, /CREATE TABLE "ProspectAssignmentTransfer"/);
  assert.match(
    migration,
    /CREATE INDEX "ProspectAssignmentTransfer_prospectId_occurredAt_idx"/,
  );
  assert.match(migration, /CREATE INDEX "ProspectAssignmentTransfer_fromUserId_idx"/);
  assert.match(migration, /CREATE INDEX "ProspectAssignmentTransfer_toUserId_idx"/);
  assert.match(
    migration,
    /CREATE INDEX "ProspectAssignmentTransfer_changedByUserId_idx"/,
  );
  assert.match(
    migration,
    /ADD CONSTRAINT "ProspectAssignmentTransfer_prospectId_fkey"/,
  );
  assert.match(
    migration,
    /ADD CONSTRAINT "ProspectAssignmentTransfer_fromUserId_fkey"/,
  );
  assert.match(
    migration,
    /ADD CONSTRAINT "ProspectAssignmentTransfer_toUserId_fkey"/,
  );
  assert.match(
    migration,
    /ADD CONSTRAINT "ProspectAssignmentTransfer_changedByUserId_fkey"/,
  );
  assert.doesNotMatch(migration, /DROP\s+(TABLE|COLUMN|TYPE|INDEX|CONSTRAINT)/i);
  assert.doesNotMatch(migration, /ALTER TABLE "Prospect"\s/);
  assert.doesNotMatch(migration, /ALTER TABLE "User"/);
  assert.doesNotMatch(migration, /ALTER TABLE "ProspectAction"/);
  assert.doesNotMatch(migration, /ALTER TABLE "ProspectActivity"/);
  assert.doesNotMatch(migration, /CREATE TYPE/);
  assert.doesNotMatch(migration, /UPDATE\s+"/i);
  assert.doesNotMatch(migration, /INSERT\s+INTO/i);
  assert.doesNotMatch(migration, /DELETE\s+FROM/i);
});

test("fromUserId is nullable; toUserId, changedByUserId, reason, and occurredAt are required", () => {
  const createTable = migration.slice(
    migration.indexOf('CREATE TABLE "ProspectAssignmentTransfer"'),
    migration.indexOf(");", migration.indexOf('CREATE TABLE "ProspectAssignmentTransfer"')),
  );

  assert.match(createTable, /"prospectId" TEXT NOT NULL/);
  assert.match(createTable, /"fromUserId" TEXT,/);
  assert.doesNotMatch(createTable, /"fromUserId" TEXT NOT NULL/);
  assert.match(createTable, /"toUserId" TEXT NOT NULL/);
  assert.match(createTable, /"changedByUserId" TEXT NOT NULL/);
  assert.match(createTable, /"reason" TEXT NOT NULL/);
  assert.match(createTable, /"occurredAt" TIMESTAMP\(3\) NOT NULL DEFAULT CURRENT_TIMESTAMP/);
});

test("every foreign key restricts deletion — Prospect and every User role reference can never be hard-deleted while a transfer references them", () => {
  assert.match(
    migration,
    /"ProspectAssignmentTransfer_prospectId_fkey" FOREIGN KEY \("prospectId"\) REFERENCES "Prospect"\("id"\) ON DELETE RESTRICT/,
  );
  assert.match(
    migration,
    /"ProspectAssignmentTransfer_fromUserId_fkey" FOREIGN KEY \("fromUserId"\) REFERENCES "User"\("id"\) ON DELETE RESTRICT/,
  );
  assert.match(
    migration,
    /"ProspectAssignmentTransfer_toUserId_fkey" FOREIGN KEY \("toUserId"\) REFERENCES "User"\("id"\) ON DELETE RESTRICT/,
  );
  assert.match(
    migration,
    /"ProspectAssignmentTransfer_changedByUserId_fkey" FOREIGN KEY \("changedByUserId"\) REFERENCES "User"\("id"\) ON DELETE RESTRICT/,
  );
  assert.doesNotMatch(migration, /ON DELETE CASCADE/);
  assert.doesNotMatch(migration, /ON DELETE SET NULL/i);
});

test("the model exists in schema.prisma with the expected required/nullable shape, no role snapshots, no name snapshots", () => {
  const modelMatch = schema.match(/model ProspectAssignmentTransfer \{[\s\S]*?\n\}/);
  assert.ok(modelMatch, "ProspectAssignmentTransfer model not found in schema");
  const model = modelMatch[0];

  assert.match(model, /prospectId\s+String/);
  assert.match(model, /fromUserId\s+String\?/);
  assert.match(model, /toUserId\s+String\s*\n/);
  assert.match(model, /changedByUserId\s+String\s*\n/);
  assert.match(model, /reason\s+String\s*\n/);
  assert.match(model, /occurredAt\s+DateTime\s+@default\(now\(\)\)/);

  assert.doesNotMatch(model, /RoleAtEvent/);
  assert.doesNotMatch(model, /UserName/);
  assert.doesNotMatch(model, /NameAtEvent/);
});

test("Prospect and User FKs use Restrict, and three distinct named relations exist on User for from/to/changedBy", () => {
  const modelMatch = schema.match(/model ProspectAssignmentTransfer \{[\s\S]*?\n\}/);
  assert.ok(modelMatch);
  const model = modelMatch[0];

  assert.match(model, /prospect\s+Prospect\s+@relation\(fields: \[prospectId\], references: \[id\], onDelete: Restrict\)/);
  assert.match(
    model,
    /fromUser\s+User\?\s+@relation\("ProspectAssignmentTransferFromUser", fields: \[fromUserId\], references: \[id\], onDelete: Restrict\)/,
  );
  assert.match(
    model,
    /toUser\s+User\s+@relation\("ProspectAssignmentTransferToUser", fields: \[toUserId\], references: \[id\], onDelete: Restrict\)/,
  );
  assert.match(
    model,
    /changedByUser\s+User\s+@relation\("ProspectAssignmentTransferChangedByUser", fields: \[changedByUserId\], references: \[id\], onDelete: Restrict\)/,
  );
});

test("Prospect gains an assignmentTransfers reverse relation, and User gains three distinct named reverse relations", () => {
  const prospectModelMatch = schema.match(/model Prospect \{[\s\S]*?\n\}/);
  assert.ok(prospectModelMatch, "Prospect model not found in schema");
  assert.match(prospectModelMatch[0], /assignmentTransfers\s+ProspectAssignmentTransfer\[\]/);

  const userModelMatch = schema.match(/model User \{[\s\S]*?\n\}/);
  assert.ok(userModelMatch, "User model not found in schema");
  assert.match(
    userModelMatch[0],
    /assignmentTransfersFrom\s+ProspectAssignmentTransfer\[\]\s+@relation\("ProspectAssignmentTransferFromUser"\)/,
  );
  assert.match(
    userModelMatch[0],
    /assignmentTransfersTo\s+ProspectAssignmentTransfer\[\]\s+@relation\("ProspectAssignmentTransferToUser"\)/,
  );
  assert.match(
    userModelMatch[0],
    /assignmentTransfersChangedBy\s+ProspectAssignmentTransfer\[\]\s+@relation\("ProspectAssignmentTransferChangedByUser"\)/,
  );
});

test("no createdByUserId/creator field was added to Prospect by this ticket (28B §5)", () => {
  const prospectModelMatch = schema.match(/model Prospect \{[\s\S]*?\n\}/);
  assert.ok(prospectModelMatch);
  assert.doesNotMatch(prospectModelMatch[0], /createdByUserId/);
});
