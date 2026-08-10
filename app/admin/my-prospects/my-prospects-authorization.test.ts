import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * /admin/my-prospects transitively imports next-auth (via requireAdmin), so
 * — like src/actions/authorization-order.test.ts and
 * app/finances/finances-authorization.test.ts — it can't be executed under
 * plain node:test outside Next's runtime. Asserted against the source.
 */

test("the page gates access via requireAdmin, not the ADMIN-or-MANAGER role set (Ticket 15H.2 — MANAGER does not get this page)", () => {
  const source = readFileSync("app/admin/my-prospects/page.tsx", "utf8");

  assert.match(source, /requireAdmin\(\)/);
  assert.doesNotMatch(source, /requireRole\(\s*"ADMIN"\s*,\s*"MANAGER"\s*\)/);
});

test("a denied (non-ADMIN) visitor is redirected to /admin, not shown partial data", () => {
  const source = readFileSync("app/admin/my-prospects/page.tsx", "utf8");

  assert.match(
    source,
    /redirect\(error\.code === "UNAUTHENTICATED" \? "\/login" : "\/admin"\)/,
  );
});

test("authorization runs before any prospect data is fetched", () => {
  const source = readFileSync("app/admin/my-prospects/page.tsx", "utf8");

  const authorizeIndex = source.indexOf("requireAdmin()");
  const fetchIndex = source.indexOf("getAdminMyProspects(");

  assert.ok(authorizeIndex >= 0, "requireAdmin() call not found");
  assert.ok(fetchIndex >= 0, "getAdminMyProspects(...) call not found");
  assert.ok(authorizeIndex < fetchIndex);
});

test("the list query is scoped by the authenticated admin's own id, never a client-supplied userId", () => {
  const source = readFileSync("app/admin/my-prospects/page.tsx", "utf8");

  assert.match(source, /getAdminMyProspects\(admin\.id, filters\)/);
  assert.doesNotMatch(source, /params\.userId/);
  assert.doesNotMatch(source, /filters\.userId/);
});

test("the KPI query is scoped by the authenticated admin's own id", () => {
  const source = readFileSync("app/admin/my-prospects/page.tsx", "utf8");

  assert.match(source, /getAdminMyProspectsKpis\(admin\.id\)/);
});
