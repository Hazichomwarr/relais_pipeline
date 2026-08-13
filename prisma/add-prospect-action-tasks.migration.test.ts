import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "prisma/migrations/20260813063747_add_prospect_action_tasks/migration.sql",
  "utf8",
);
const schema = readFileSync("prisma/schema.prisma", "utf8");

test("prospect action migration only adds a new enum, a new table, indexes, and foreign keys", () => {
  assert.match(migration, /CREATE TYPE "ProspectActionStatus"/);
  assert.match(migration, /CREATE TABLE "ProspectAction"/);
  assert.doesNotMatch(migration, /DROP\s+(TABLE|COLUMN|TYPE)/i);
  assert.doesNotMatch(migration, /ALTER TABLE "User"/);
  assert.doesNotMatch(migration, /ALTER TABLE "Prospect"/);
  assert.doesNotMatch(migration, /UPDATE\s+"/i);
  assert.doesNotMatch(migration, /INSERT\s+INTO/i);
  assert.doesNotMatch(migration, /DELETE\s+FROM/i);
});

test("ProspectAction restricts deletion of its Prospect and every User relation — no cascade wipes real task history", () => {
  assert.match(
    migration,
    /"ProspectAction_prospectId_fkey" FOREIGN KEY \("prospectId"\) REFERENCES "Prospect"\("id"\) ON DELETE RESTRICT/,
  );

  for (const column of [
    "assignedToUserId",
    "createdByUserId",
    "completedByUserId",
    "canceledByUserId",
  ]) {
    assert.match(
      migration,
      new RegExp(
        `"ProspectAction_${column}_fkey" FOREIGN KEY \\("${column}"\\) REFERENCES "User"\\("id"\\) ON DELETE RESTRICT`,
      ),
    );
  }
});

test("dueAt, assignedToUserId, and createdByUserId are required — a ProspectAction cannot exist without them", () => {
  assert.match(migration, /"dueAt" TIMESTAMP\(3\) NOT NULL/);
  assert.match(migration, /"assignedToUserId" TEXT NOT NULL/);
  assert.match(migration, /"createdByUserId" TEXT NOT NULL/);
});

test("completion and cancellation fields are nullable — every ProspectAction starts OPEN with none of them set", () => {
  assert.match(migration, /"completedAt" TIMESTAMP\(3\),/);
  assert.match(migration, /"completedByUserId" TEXT,/);
  assert.match(migration, /"canceledAt" TIMESTAMP\(3\),/);
  assert.match(migration, /"canceledByUserId" TEXT,/);
  assert.match(migration, /"cancellationReason" TEXT,/);
});

test("status defaults to OPEN at the database level, matching the service's server-controlled create", () => {
  assert.match(
    migration,
    /"status" "ProspectActionStatus" NOT NULL DEFAULT 'OPEN'/,
  );
});

test("no legacy Prospect.nextAction/followUpDate columns were touched or removed", () => {
  const prospectModelMatch = schema.match(/model Prospect \{[\s\S]*?\n\}/);
  assert.ok(prospectModelMatch, "Prospect model not found in schema");
  assert.match(prospectModelMatch[0], /nextAction\s+FollowUpAction\?/);
  assert.match(prospectModelMatch[0], /followUpDate\s+DateTime\?/);
});

test("the lifecycle enum stays deliberately small — no persisted IN_PROGRESS/OVERDUE/URGENT", () => {
  const enumMatch = schema.match(/enum ProspectActionStatus \{[\s\S]*?\n\}/);
  assert.ok(enumMatch, "ProspectActionStatus enum not found in schema");
  assert.match(enumMatch[0], /OPEN/);
  assert.match(enumMatch[0], /COMPLETED/);
  assert.match(enumMatch[0], /CANCELED/);
  assert.doesNotMatch(enumMatch[0], /IN_PROGRESS|OVERDUE|URGENT|BLOCKED|WAITING|DEFERRED/);
});
