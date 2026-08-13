import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "prisma/migrations/20260813073236_add_prospect_conversion_outcome_reason/migration.sql",
  "utf8",
);
const schema = readFileSync("prisma/schema.prisma", "utf8");

test("migration only adds two new enums and three new nullable columns on ProspectActivity — no drops, no data rewrite", () => {
  assert.match(migration, /CREATE TYPE "ProspectConversionOutcome"/);
  assert.match(migration, /CREATE TYPE "ProspectConversionReason"/);
  assert.match(migration, /ALTER TABLE "ProspectActivity" ADD COLUMN\s+"conversionOutcome"/);
  assert.match(migration, /ADD COLUMN\s+"conversionReason"/);
  assert.match(migration, /ADD COLUMN\s+"conversionReasonNote"/);
  assert.doesNotMatch(migration, /DROP\s+(TABLE|COLUMN|TYPE)/i);
  assert.doesNotMatch(migration, /ALTER TABLE "Prospect"\s/);
  assert.doesNotMatch(migration, /ALTER TABLE "User"/);
  assert.doesNotMatch(migration, /UPDATE\s+"/i);
  assert.doesNotMatch(migration, /INSERT\s+INTO/i);
  assert.doesNotMatch(migration, /DELETE\s+FROM/i);
});

test("the new ProspectActivity columns are nullable — no backfill is required or possible", () => {
  assert.doesNotMatch(migration, /"conversionOutcome"[^,]*NOT NULL/);
  assert.doesNotMatch(migration, /"conversionReason"[^,]*NOT NULL/);
  assert.doesNotMatch(migration, /"conversionReasonNote"[^,]*NOT NULL/);
});

test("ProspectConversionOutcome is exactly ADVANCED, STALLED, WON, LOST", () => {
  assert.match(
    migration,
    /CREATE TYPE "ProspectConversionOutcome" AS ENUM \('ADVANCED', 'STALLED', 'WON', 'LOST'\);/,
  );
});

test("the ProspectConversionReason taxonomy is locked to the audited 15 values", () => {
  const reasonEnumMatch = migration.match(
    /CREATE TYPE "ProspectConversionReason" AS ENUM \(([^)]+)\);/,
  );
  assert.ok(reasonEnumMatch, "ProspectConversionReason enum not found in migration");

  const values = reasonEnumMatch[1]
    .split(",")
    .map((value) => value.trim().replace(/^'|'$/g, ""));

  assert.deepEqual(values, [
    "PROMOTIONAL_OFFER",
    "DEMO_CONVINCED",
    "GOOD_PRODUCT_FIT",
    "URGENT_NEED",
    "PRICE_ACCEPTABLE",
    "DECISION_MAKER_APPROVAL",
    "NO_BUDGET",
    "PRICE_TOO_HIGH",
    "DECISION_MAKER_UNAVAILABLE",
    "ALREADY_EQUIPPED",
    "NO_RESPONSE",
    "NEEDS_MORE_TIME",
    "BAD_FIT",
    "COMPETITOR",
    "OTHER",
  ]);
});

test("no campaign-specific reason value was introduced (École Pilote, website trial, discount amounts, ...)", () => {
  const forbidden = [
    /ECOLE_PILOTE/i,
    /WEBSITE_TRIAL/i,
    /PILOT/i,
    /KARMDA_/i,
    /5000/,
    /CFA/i,
  ];
  for (const pattern of forbidden) {
    assert.doesNotMatch(migration, pattern);
  }
});

test("outcome/reason live on ProspectActivity, not as a new current field on Prospect — outcome is historical, not current state", () => {
  const prospectModelMatch = schema.match(/model Prospect \{[\s\S]*?\n\}/);
  assert.ok(prospectModelMatch, "Prospect model not found in schema");
  assert.doesNotMatch(prospectModelMatch[0], /conversionOutcome|conversionReason/);

  const activityModelMatch = schema.match(/model ProspectActivity \{[\s\S]*?\n\}/);
  assert.ok(activityModelMatch, "ProspectActivity model not found in schema");
  assert.match(activityModelMatch[0], /conversionOutcome\s+ProspectConversionOutcome\?/);
  assert.match(activityModelMatch[0], /conversionReason\s+ProspectConversionReason\?/);
  assert.match(activityModelMatch[0], /conversionReasonNote\s+String\?/);
});
