import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "prisma/migrations/20260901210000_add_workday_foundation/migration.sql",
  "utf8",
);
const schema = readFileSync("prisma/schema.prisma", "utf8");

test("migration only creates the Workday table and its constraints/indexes — no existing table is touched, no data is inserted or backfilled", () => {
  assert.match(migration, /CREATE TABLE "Workday"/);
  assert.doesNotMatch(migration, /DROP\s+(TABLE|COLUMN|TYPE|INDEX|CONSTRAINT)/i);
  assert.doesNotMatch(migration, /ALTER TABLE "User"/);
  assert.doesNotMatch(migration, /ALTER TABLE "Organization/);
  assert.doesNotMatch(migration, /UPDATE\s+"/i);
  assert.doesNotMatch(migration, /INSERT\s+INTO/i);
  assert.doesNotMatch(migration, /DELETE\s+FROM/i);

  const alterTableStatements = migration.match(/ALTER TABLE "\w+"/g) ?? [];
  assert.deepEqual(alterTableStatements, ['ALTER TABLE "Workday"', 'ALTER TABLE "Workday"']);
});

test("employeeUserId and confirmedByUserId are Restrict foreign keys to User — no Cascade, no SetNull", () => {
  assert.match(
    migration,
    /"Workday_employeeUserId_fkey" FOREIGN KEY \("employeeUserId"\) REFERENCES "User"\("id"\) ON DELETE RESTRICT/,
  );
  assert.match(
    migration,
    /"Workday_confirmedByUserId_fkey" FOREIGN KEY \("confirmedByUserId"\) REFERENCES "User"\("id"\) ON DELETE RESTRICT/,
  );
  assert.doesNotMatch(migration, /Workday.*ON DELETE (CASCADE|SET NULL)/is);
});

test("one employee, one RELAIS business date, at most one Workday — enforced by a database unique constraint", () => {
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "Workday_employeeUserId_workDate_key" ON "Workday"\("employeeUserId", "workDate"\)/,
  );
  const model = schema.match(/model Workday \{[\s\S]*?\n\}/);
  assert.ok(model, "Workday model not found");
  assert.match(model[0], /@@unique\(\[employeeUserId, workDate\]\)/);
});

test("startedAt is required — a Workday row cannot exist without a start declaration", () => {
  assert.match(migration, /"startedAt" TIMESTAMP\(3\) NOT NULL,/);
  const model = schema.match(/model Workday \{[\s\S]*?\n\}/);
  assert.ok(model, "Workday model not found");
  assert.match(model[0], /startedAt\s+DateTime\n/);
});

test("employeeUserId, workDate, expectedStartTime, and expectedEndTime are all required", () => {
  assert.match(migration, /"employeeUserId" TEXT NOT NULL,/);
  assert.match(migration, /"workDate" TIMESTAMP\(3\) NOT NULL,/);
  assert.match(migration, /"expectedStartTime" INTEGER NOT NULL,/);
  assert.match(migration, /"expectedEndTime" INTEGER NOT NULL,/);
});

test("confirmedAt, confirmedByUserId, and endedAt are all nullable — an unconfirmed or still-open workday is valid history", () => {
  assert.match(migration, /"confirmedAt" TIMESTAMP\(3\),/);
  assert.match(migration, /"confirmedByUserId" TEXT,/);
  assert.match(migration, /"endedAt" TIMESTAMP\(3\),/);

  const model = schema.match(/model Workday \{[\s\S]*?\n\}/);
  assert.ok(model, "Workday model not found");
  assert.match(model[0], /confirmedAt\s+DateTime\?/);
  assert.match(model[0], /confirmedByUserId\s+String\?/);
  assert.match(model[0], /endedAt\s+DateTime\?/);
});

test("no status/lifecycle enum, no lateness field, no role-at-event snapshot, no organizationId, and no relation to DailyTask/Prospect/ProspectAction/DailyReport", () => {
  const model = schema.match(/model Workday \{([\s\S]*?)\n\}/);
  assert.ok(model, "Workday model not found");

  // Strip comment lines first — the model's own explanatory comments
  // legitimately contain prose like "never later rewritten," which must
  // not be mistaken for a `late`/`status`-named field.
  const fieldsOnly = model[1]
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");

  assert.doesNotMatch(fieldsOnly, /status/i);
  assert.doesNotMatch(fieldsOnly, /late/i);
  assert.doesNotMatch(fieldsOnly, /RoleAtEvent|RoleAtWorkday|roleAt/i);
  assert.doesNotMatch(fieldsOnly, /organizationId/);
  assert.doesNotMatch(fieldsOnly, /dailyTask/i);
  assert.doesNotMatch(fieldsOnly, /prospect/i);
  assert.doesNotMatch(fieldsOnly, /dailyReport/i);

  assert.doesNotMatch(schema, /enum WorkdayStatus/);
});

test("Workday has exactly the field set 27A decided — nothing more", () => {
  const model = schema.match(/model Workday \{([\s\S]*?)\n\}/);
  assert.ok(model, "Workday model not found");

  const fieldLines = model[1]
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 0 &&
        !line.startsWith("//") &&
        !line.startsWith("@@"),
    );

  const fieldNames = fieldLines.map((line) => line.split(/\s+/)[0]);

  assert.deepEqual(fieldNames, [
    "id",
    "employeeUserId",
    "employee",
    "workDate",
    "expectedStartTime",
    "expectedEndTime",
    "startedAt",
    "confirmedAt",
    "confirmedByUserId",
    "confirmedBy",
    "endedAt",
    "createdAt",
    "updatedAt",
  ]);
});

test("User gains exactly two new Workday relations, named for the two distinct roles a User can play", () => {
  const userModel = schema.match(/model User \{[\s\S]*?\n\}/);
  assert.ok(userModel, "User model not found");
  assert.match(userModel[0], /workdays\s+Workday\[\]\s+@relation\("EmployeeWorkdays"\)/);
  assert.match(userModel[0], /confirmedWorkdays\s+Workday\[\]\s+@relation\("ConfirmedWorkdays"\)/);
});
