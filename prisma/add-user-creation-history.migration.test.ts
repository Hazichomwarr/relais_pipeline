import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "prisma/migrations/20260821120000_add_user_creation_history/migration.sql",
  "utf8",
);
const schema = readFileSync("prisma/schema.prisma", "utf8");
const persistenceService = readFileSync(
  "src/services/user-creation-history.service.ts",
  "utf8",
);
const sharedFeedService = readFileSync(
  "src/services/shared-feed.service.ts",
  "utf8",
);

test("creation-history migration is additive and deliberately performs no historical backfill", () => {
  assert.match(migration, /CREATE TABLE "UserCreationActivity"/);
  assert.doesNotMatch(migration, /DROP\s+(TABLE|COLUMN|TYPE)/i);
  assert.doesNotMatch(migration, /INSERT\s+INTO/i);
  assert.doesNotMatch(migration, /UPDATE\s+"User"/i);
  assert.doesNotMatch(migration, /DELETE\s+FROM/i);
});

test("one creation fact per subject is enforced structurally", () => {
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "UserCreationActivity_subjectUserId_key" ON "UserCreationActivity"\("subjectUserId"\)/,
  );
  const model = schema.match(/model UserCreationActivity \{[\s\S]*?\n\}/);
  assert.ok(model, "UserCreationActivity model not found");
  assert.match(model[0], /subjectUserId\s+String\s+@unique/);
});

test("creation history preserves subject, authenticated actor, role snapshot, and timestamp", () => {
  assert.match(migration, /"subjectUserId" TEXT NOT NULL/);
  assert.match(migration, /"actorUserId" TEXT NOT NULL/);
  assert.match(migration, /"roleAtEvent" "UserRole" NOT NULL/);
  assert.match(
    migration,
    /"occurredAt" TIMESTAMP\(3\) NOT NULL DEFAULT CURRENT_TIMESTAMP/,
  );
  assert.match(migration, /"subjectUserId"\) REFERENCES "User"\("id"\) ON DELETE RESTRICT/);
  assert.match(migration, /"actorUserId"\) REFERENCES "User"\("id"\) ON DELETE RESTRICT/);
});

test("user creation and its history row share one Prisma transaction and snapshot the persisted role", () => {
  assert.match(persistenceService, /prisma\.\$transaction\(async \(transaction\) =>/);
  assert.match(persistenceService, /transaction\.user\.create/);
  assert.match(persistenceService, /transaction\.userCreationActivity\.create/);
  assert.match(persistenceService, /roleAtEvent:\s*user\.role/);
});

test("Ticket 25C does not add creation history to the shared feed", () => {
  assert.doesNotMatch(sharedFeedService, /userCreationActivity/);
  assert.doesNotMatch(sharedFeedService, /UserCreationActivity/);
});
