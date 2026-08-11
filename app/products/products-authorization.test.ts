import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * /products transitively imports next-auth (via requireRole), so — like
 * app/schools/... and src/actions/authorization-order.test.ts — it can't be
 * executed under plain node:test outside Next's runtime. Asserted against
 * the source, mirroring app/schools/layout.tsx's own (untested-by-name but
 * identical) pattern.
 */

test("the products layout gates access to ADMIN, MANAGER, and COMMERCIAL — the same set as the legacy school directory", () => {
  const source = readFileSync("app/products/layout.tsx", "utf8");

  assert.match(source, /requireRole\("ADMIN", "MANAGER", "COMMERCIAL"\)/);
  assert.match(
    source,
    /redirect\(error\.code === "UNAUTHENTICATED" \? "\/login" : "\/"\)/,
  );
});

test("the products layout redirects before any product/prospect data is fetched", () => {
  const source = readFileSync("app/products/layout.tsx", "utf8");

  assert.doesNotMatch(source, /getProductDirectoryOverview\(/);
  assert.doesNotMatch(source, /prisma\./);
});

test("the products landing page authorizes via requireRole before fetching the overview", () => {
  const source = readFileSync("app/products/page.tsx", "utf8");

  const authorizeIndex = source.indexOf("requireRole(");
  const fetchIndex = source.indexOf("getProductDirectoryOverview(");

  assert.ok(authorizeIndex >= 0, "requireRole(...) call not found");
  assert.ok(fetchIndex >= 0, "getProductDirectoryOverview() call not found");
  assert.ok(authorizeIndex < fetchIndex);
});

test("the products landing page never fetches raw prospect rows for client-side filtering", () => {
  const source = readFileSync("app/products/page.tsx", "utf8");

  assert.doesNotMatch(source, /getProspects\(/);
  assert.doesNotMatch(source, /prisma\./);
});

test("the products landing page renders CommercialShell for COMMERCIAL and AdminShell otherwise, like /schools and /updates", () => {
  const source = readFileSync("app/products/page.tsx", "utf8");

  assert.match(source, /user\.role === "COMMERCIAL"/);
  assert.match(source, /<CommercialShell/);
  assert.match(source, /<AdminShell activeItem="products">/);
});
