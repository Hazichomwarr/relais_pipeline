import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * These pages transitively import next-auth, so — like every other
 * *-authorization.test.ts in this repo — they're asserted against source.
 */
const genericDirectoryPages = [
  { file: "app/products/digital-services/page.tsx", product: "DIGITAL_SERVICES" },
  { file: "app/products/lokari/page.tsx", product: "LOKARI" },
  { file: "app/products/nia/page.tsx", product: "NIA" },
];

for (const { file, product } of genericDirectoryPages) {
  test(`${file} authorizes via requireRole before fetching prospects`, () => {
    const source = readFileSync(file, "utf8");

    const authorizeIndex = source.indexOf("requireRole(");
    const fetchIndex = source.indexOf("getProspects(");

    assert.ok(authorizeIndex >= 0, "requireRole(...) call not found");
    assert.ok(fetchIndex >= 0, "getProspects(...) call not found");
    assert.ok(authorizeIndex < fetchIndex);
  });

  test(`${file} scopes its list to product: "${product}" — never a global, unfiltered fetch`, () => {
    const source = readFileSync(file, "utf8");

    assert.match(
      source,
      new RegExp(`getProspects\\(\\{ product: "${product}" \\}\\)`),
    );
  });

  test(`${file} has no search input or filter UI — that belongs to a full product directory (Ticket 15G.2)`, () => {
    const source = readFileSync(file, "utf8");

    assert.doesNotMatch(source, /type="search"/);
    assert.doesNotMatch(source, /Filters/);
  });

  test(`${file} resolves detail links via resolveGenericProductDetailHref, never a raw/unconditional prospect link`, () => {
    const source = readFileSync(file, "utf8");

    assert.match(source, /resolveGenericProductDetailHref\(user, prospect\)/);
  });
}
