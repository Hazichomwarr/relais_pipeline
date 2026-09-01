import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "prisma/migrations/20260901160000_add_organization_membership_foundation/migration.sql",
  "utf8",
);
const schema = readFileSync("prisma/schema.prisma", "utf8");
const userCreationHistoryService = readFileSync(
  "src/services/user-creation-history.service.ts",
  "utf8",
);
const userService = readFileSync("src/services/user.service.ts", "utf8");

test("migration is purely additive — creates two tables plus their constraints, and populates them; nothing about User is dropped or rewritten", () => {
  assert.match(migration, /CREATE TABLE "Organization"/);
  assert.match(migration, /CREATE TABLE "OrganizationMembership"/);
  assert.doesNotMatch(migration, /DROP\s+(TABLE|COLUMN|TYPE|INDEX|CONSTRAINT)/i);
  assert.doesNotMatch(migration, /ALTER TABLE "User"/);
  assert.doesNotMatch(migration, /UPDATE\s+"User"/i);
  assert.doesNotMatch(migration, /DELETE\s+FROM/i);
});

test("Organization slug is globally unique — the stable tenant lookup key", () => {
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"\("slug"\)/,
  );
  const model = schema.match(/model Organization \{[\s\S]*?\n\}/);
  assert.ok(model, "Organization model not found");
  assert.match(model[0], /slug\s+String\s+@unique/);
});

test("membership uniqueness is [organizationId, userId], not a global unique on userId — a User must be able to structurally belong to multiple Organizations", () => {
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "OrganizationMembership_organizationId_userId_key" ON "OrganizationMembership"\("organizationId", "userId"\)/,
  );

  const model = schema.match(/model OrganizationMembership \{[\s\S]*?\n\}/);
  assert.ok(model, "OrganizationMembership model not found");
  assert.match(model[0], /@@unique\(\[organizationId, userId\]\)/);
  assert.doesNotMatch(model[0], /userId\s+String\s+@unique/);
});

test("membership role reuses the existing UserRole enum — no second role concept", () => {
  const model = schema.match(/model OrganizationMembership \{[\s\S]*?\n\}/);
  assert.ok(model, "OrganizationMembership model not found");
  assert.match(model[0], /role\s+UserRole/);
  assert.match(migration, /"role" "UserRole" NOT NULL/);
});

test("User relation is global — one User may belong to multiple Organizations", () => {
  const userModel = schema.match(/model User \{[\s\S]*?\n\}/);
  assert.ok(userModel, "User model not found");
  assert.match(userModel[0], /organizationMemberships\s+OrganizationMembership\[\]/);

  const organizationModel = schema.match(/model Organization \{[\s\S]*?\n\}/);
  assert.ok(organizationModel, "Organization model not found");
  assert.match(organizationModel[0], /memberships\s+OrganizationMembership\[\]/);
});

test("neither User nor Organization can be silently cascade-deleted through a membership", () => {
  assert.match(
    migration,
    /"OrganizationMembership_organizationId_fkey" FOREIGN KEY \("organizationId"\) REFERENCES "Organization"\("id"\) ON DELETE RESTRICT/,
  );
  assert.match(
    migration,
    /"OrganizationMembership_userId_fkey" FOREIGN KEY \("userId"\) REFERENCES "User"\("id"\) ON DELETE RESTRICT/,
  );
});

test("the canonical RELAIS organization is created by the migration itself, idempotently, via its stable slug — not by app seed", () => {
  assert.match(
    migration,
    /INSERT INTO "Organization"[\s\S]*?VALUES \(gen_random_uuid\(\)::text, 'RELAIS', 'relais', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP\)/,
  );
  assert.match(migration, /INSERT INTO "Organization"[\s\S]*?ON CONFLICT \("slug"\) DO NOTHING;/);
});

test("every existing User is backfilled into exactly one RELAIS membership, with role copied verbatim from User.role — no default, no reinterpretation", () => {
  const backfill = migration.match(
    /INSERT INTO "OrganizationMembership"[\s\S]*?ON CONFLICT \("organizationId", "userId"\) DO NOTHING;/,
  );
  assert.ok(backfill, "membership backfill INSERT not found");

  assert.match(backfill[0], /FROM "User"/);
  assert.match(backfill[0], /"User"\."role"/);
  // No CASE/WHEN, COALESCE, or hardcoded role literal near the backfill —
  // this would indicate role reinterpretation or a default fallback.
  assert.doesNotMatch(backfill[0], /CASE|COALESCE|'ADMIN'|'MANAGER'|'COMMERCIAL'|'ASSISTANT'/);
});

test("table/constraint creation happens before the RELAIS insert, which happens before the membership backfill (staged, dependency-safe order)", () => {
  const createOrganizationTable = migration.indexOf('CREATE TABLE "Organization"');
  const createMembershipTable = migration.indexOf('CREATE TABLE "OrganizationMembership"');
  const uniqueConstraints = migration.indexOf("CREATE UNIQUE INDEX");
  const insertOrganization = migration.indexOf('INSERT INTO "Organization"');
  const insertMembership = migration.indexOf('INSERT INTO "OrganizationMembership"');

  assert.ok(createOrganizationTable >= 0);
  assert.ok(createMembershipTable > createOrganizationTable);
  assert.ok(uniqueConstraints > createMembershipTable);
  assert.ok(insertOrganization > uniqueConstraints);
  assert.ok(insertMembership > insertOrganization);
});

test("user creation and its RELAIS membership share one Prisma transaction with the existing creation-history write", () => {
  assert.match(userCreationHistoryService, /prisma\.\$transaction\(async \(transaction\) =>/);
  assert.match(userCreationHistoryService, /resolveRelaisOrganizationId\(transaction\)/);
  assert.match(userCreationHistoryService, /transaction\.user\.create/);
  assert.match(userCreationHistoryService, /transaction\.userCreationActivity\.create/);
  assert.match(userCreationHistoryService, /transaction\.organizationMembership\.create/);

  const createIndex = userCreationHistoryService.indexOf("transaction.user.create");
  const membershipIndex = userCreationHistoryService.indexOf(
    "transaction.organizationMembership.create",
  );
  assert.ok(
    createIndex >= 0 && membershipIndex > createIndex,
    "membership must be created after the user row inside the same transaction",
  );
});

test("a User.role edit keeps the RELAIS membership role synchronized in the same transaction, without switching runtime authority", () => {
  assert.match(userService, /resolveRelaisOrganizationId\(transaction\)/);
  assert.match(
    userService,
    /transaction\.organizationMembership\.update\(\{\s*\n\s*where: \{ organizationId_userId: \{ organizationId, userId \} \},/,
  );
});
