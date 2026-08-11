import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * This page transitively imports next-auth (via requireRole), so — like
 * every other *-authorization.test.ts in this repo — it's asserted
 * against source.
 */

test("authorizes via requireRole before fetching the directory", () => {
  const source = readFileSync("app/products/digital-services/page.tsx", "utf8");

  const authorizeIndex = source.indexOf("requireRole(");
  const fetchIndex = source.indexOf("getDigitalServicesDirectory(");

  assert.ok(authorizeIndex >= 0, "requireRole(...) call not found");
  assert.ok(fetchIndex >= 0, "getDigitalServicesDirectory(...) call not found");
  assert.ok(authorizeIndex < fetchIndex);
});

test("search is executed in Prisma (via the service), never fetched unfiltered for client-side filtering", () => {
  const source = readFileSync("app/products/digital-services/page.tsx", "utf8");

  assert.match(source, /getDigitalServicesDirectory\(\{ search \}\)/);
  assert.doesNotMatch(source, /getProspects\(/);
  assert.doesNotMatch(source, /prisma\./);
});

test("has a real search input, unlike the LOKARI/NIA foundation pages", () => {
  const source = readFileSync("app/products/digital-services/page.tsx", "utf8");

  assert.match(source, /type="search"/);
  assert.match(source, /name="search"/);
});

test("resolves detail links via resolveGenericProductDetailHref with a Digital Services foreignHref, giving foreign COMMERCIAL viewers the shared read-only route", () => {
  const source = readFileSync("app/products/digital-services/page.tsx", "utf8");

  assert.match(
    source,
    /foreignHref: \(id\) => `\/products\/digital-services\/\$\{id\}`/,
  );
});

test("wraps resolved detail links with a safe returnTo back to the (possibly filtered) directory", () => {
  const source = readFileSync("app/products/digital-services/page.tsx", "utf8");

  assert.match(source, /buildReturnToPath\("\/products\/digital-services", params\)/);
  assert.match(source, /appendReturnTo\(href, returnTo\)/);
});

test("distinguishes the first-use empty state from the filtered (search-matched-zero) empty state", () => {
  const source = readFileSync("app/products/digital-services/page.tsx", "utf8");

  assert.match(source, /Aucun prospect Services Digitaux enregistré\./);
  assert.match(source, /Aucune entreprise ne correspond à cette recherche\./);
  assert.match(source, /Réinitialiser la recherche/);
});

test("renders CommercialShell for COMMERCIAL and AdminShell otherwise, consistent with the other product directories", () => {
  const source = readFileSync("app/products/digital-services/page.tsx", "utf8");

  assert.match(source, /user\.role === "COMMERCIAL"/);
  assert.match(source, /<CommercialShell/);
  assert.match(source, /<AdminShell activeItem="products">/);
});
