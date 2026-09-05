import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * This page transitively imports next-auth (via requireRole), so it's
 * asserted against source, like every other authorization test in this
 * repo.
 */
const PAGE = "app/products/digital-services/[prospectId]/page.tsx";

test("authorizes ADMIN, MANAGER, and COMMERCIAL — the same shared-directory access policy as the list page", () => {
  const source = readFileSync(PAGE, "utf8");

  assert.match(source, /requireRole\("ADMIN", "MANAGER", "COMMERCIAL"\)/);
});

test("authorizes before fetching the prospect", () => {
  const source = readFileSync(PAGE, "utf8");

  const authorizeIndex = source.indexOf("requireRole(");
  const fetchIndex = source.indexOf("getDigitalServicesProspectById(");

  assert.ok(authorizeIndex >= 0);
  assert.ok(fetchIndex >= 0);
  assert.ok(authorizeIndex < fetchIndex);
});

test("calls notFound() for a missing prospect", () => {
  const source = readFileSync(PAGE, "utf8");

  assert.match(source, /if \(!prospect\) \{\s*notFound\(\);/);
});

test("the underlying query is scoped to product: DIGITAL_SERVICES — a KARMDA/LOKARI/NIA id can never resolve here", () => {
  const serviceSource = readFileSync(
    "src/services/digital-services-directory.service.ts",
    "utf8",
  );

  const fnMatch = serviceSource.match(
    /export async function getDigitalServicesProspectById[\s\S]*?\n}/,
  );

  assert.ok(fnMatch, "getDigitalServicesProspectById not found");
  assert.match(fnMatch![0], /product: "DIGITAL_SERVICES"/);
});

test("renders no mutation controls — no follow-up form, no activity-creation form", () => {
  const source = readFileSync(PAGE, "utf8");

  assert.doesNotMatch(source, /ProspectFollowUpForm/);
  assert.doesNotMatch(source, /ProspectActivityForm/);
  assert.doesNotMatch(source, /createProspectActivityAction/);
  assert.doesNotMatch(source, /updateCommercialProspectFollowUpAction/);
});

test("never queries PersonalNote, LedgerEntry, or user-management data", () => {
  const source = readFileSync(PAGE, "utf8");

  assert.doesNotMatch(source, /PersonalNote/);
  assert.doesNotMatch(source, /LedgerEntry/i);
  assert.doesNotMatch(source, /listUsers\(/);
});

test("reuses the shared read-only prospect-detail and activity-timeline building blocks — no duplicated formatting logic", () => {
  const source = readFileSync(PAGE, "utf8");

  assert.match(source, /from "@\/component\/propects\/prospect-detail-sections"/);
  assert.match(source, /<ProspectActivityTimeline/);
  assert.match(source, /<ProductDetailSection prospect={prospect} \/>/);
});

test("shows the compact ReadOnlyNotice and 'Responsable du suivi' terminology", () => {
  const source = readFileSync(PAGE, "utf8");

  assert.match(source, /<ReadOnlyNotice responsible={responsible} \/>/);
  assert.match(source, /Responsable du suivi/);
});

test("resolves a safe returnTo, defaulting back to the directory list, never trusting an unsafe value", () => {
  const source = readFileSync(PAGE, "utf8");

  assert.match(
    source,
    /resolveSafeReturnTo\(returnTo, "\/products\/digital-services"\)/,
  );
});

test("the not-found page never reveals that the id exists under a different product", () => {
  const source = readFileSync(
    "app/products/digital-services/[prospectId]/not-found.tsx",
    "utf8",
  );

  assert.doesNotMatch(source, /produit/i);
  assert.match(source, /Prospect introuvable/);
});
