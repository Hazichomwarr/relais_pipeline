import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * These pages transitively import next-auth (via requireRole), so they're
 * asserted against source, like every other authorization test in this
 * repo. Mirrors digital-services-summary.test.ts's assertions exactly —
 * LOKARI/NIA are the same shape, closing the read-only parity gap 28A
 * found (Ticket 28C).
 */
const summaryPages = [
  {
    product: "LOKARI",
    page: "app/products/lokari/[prospectId]/page.tsx",
    notFound: "app/products/lokari/[prospectId]/not-found.tsx",
    service: "src/services/generic-product-directory.service.ts",
    getter: "getLokariProspectById",
    returnTo: "/products/lokari",
  },
  {
    product: "NIA",
    page: "app/products/nia/[prospectId]/page.tsx",
    notFound: "app/products/nia/[prospectId]/not-found.tsx",
    service: "src/services/generic-product-directory.service.ts",
    getter: "getNiaProspectById",
    returnTo: "/products/nia",
  },
] as const;

for (const { product, page, notFound, service, getter, returnTo } of summaryPages) {
  test(`${product}: authorizes ADMIN, MANAGER, and COMMERCIAL — the same shared-directory access policy as the list page`, () => {
    const source = readFileSync(page, "utf8");
    assert.match(source, /requireRole\("ADMIN", "MANAGER", "COMMERCIAL"\)/);
  });

  test(`${product}: authorizes before fetching the prospect`, () => {
    const source = readFileSync(page, "utf8");
    const authorizeIndex = source.indexOf("requireRole(");
    const fetchIndex = source.indexOf(`${getter}(`);

    assert.ok(authorizeIndex >= 0);
    assert.ok(fetchIndex >= 0);
    assert.ok(authorizeIndex < fetchIndex);
  });

  test(`${product}: calls notFound() for a missing prospect`, () => {
    const source = readFileSync(page, "utf8");
    assert.match(source, /if \(!prospect\) \{\s*notFound\(\);/);
  });

  test(`${product}: the underlying query is scoped to its own product — a different-product id can never resolve here`, () => {
    const serviceSource = readFileSync(service, "utf8");
    const fnMatch = serviceSource.match(
      new RegExp(`export async function ${getter}[\\s\\S]*?\\n}`),
    );
    assert.ok(fnMatch, `${getter} not found`);
    assert.match(fnMatch![0], /getGenericProductProspectById\(/);
  });

  test(`${product}: getGenericProductProspectById itself scopes every call by product`, () => {
    const serviceSource = readFileSync(service, "utf8");
    assert.match(serviceSource, /where:\s*\{\s*id:\s*prospectId,\s*product\s*\}/);
  });

  test(`${product}: renders no mutation controls — no follow-up form, no activity-creation form, no reassignment`, () => {
    const source = readFileSync(page, "utf8");
    assert.doesNotMatch(source, /ProspectFollowUpForm/);
    assert.doesNotMatch(source, /ProspectActivityForm/);
    assert.doesNotMatch(source, /createProspectActivityAction/);
    assert.doesNotMatch(source, /updateCommercialProspectFollowUpAction/);
    assert.doesNotMatch(source, /ReassignProspectDialog/);
    assert.doesNotMatch(source, /reassignProspectAction/);
  });

  test(`${product}: never queries management-only transfer history, PersonalNote, LedgerEntry, or user-management data`, () => {
    const source = readFileSync(page, "utf8");
    assert.doesNotMatch(source, /getProspectAssignmentTransfers/);
    assert.doesNotMatch(source, /PersonalNote/);
    assert.doesNotMatch(source, /LedgerEntry/i);
    assert.doesNotMatch(source, /listUsers\(/);
  });

  test(`${product}: reuses the shared read-only prospect-detail and activity-timeline building blocks — no duplicated formatting logic`, () => {
    const source = readFileSync(page, "utf8");
    assert.match(source, /from "@\/component\/propects\/prospect-detail-sections"/);
    assert.match(source, /<ProspectActivityTimeline/);
    assert.match(source, /<ProductDetailSection prospect={prospect} \/>/);
  });

  test(`${product}: shows the compact ReadOnlyNotice and "Responsable du suivi" terminology — never the old "appartient à" wording`, () => {
    const source = readFileSync(page, "utf8");
    assert.match(source, /<ReadOnlyNotice responsible={responsible} \/>/);
    assert.match(source, /Responsable du suivi/);
    assert.doesNotMatch(source, /appartient/i);
  });

  test(`${product}: resolves a safe returnTo, defaulting back to the directory list, never trusting an unsafe value`, () => {
    const source = readFileSync(page, "utf8");
    assert.match(
      source,
      new RegExp(`resolveSafeReturnTo\\(returnTo, "${returnTo}"\\)`),
    );
  });

  test(`${product}: the not-found page never reveals that the id exists under a different product`, () => {
    const source = readFileSync(notFound, "utf8");
    assert.doesNotMatch(source, /produit/i);
    assert.match(source, /Prospect introuvable/);
  });
}
