import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * /admin/my-prospects transitively imports next-auth (via
 * requireMyProspectsAccess), so — like src/actions/authorization-order.test.ts
 * and app/finances/finances-authorization.test.ts — it can't be executed
 * under plain node:test outside Next's runtime. Asserted against the source.
 */

test("the page gates access via requireMyProspectsAccess (Ticket 21B — ADMIN and MANAGER both get this page; COMMERCIAL has its own equivalent at /dashboard/commercial)", () => {
  const source = readFileSync("app/admin/my-prospects/page.tsx", "utf8");

  assert.match(source, /requireMyProspectsAccess\(\)/);
  assert.doesNotMatch(source, /requireAdmin\(\)/);
  assert.doesNotMatch(source, /requireRole\(/);
});

test("MY_PROSPECTS_ROLES is ADMIN/MANAGER only — the same set as 20F/20G's SALES_ANALYTICS_ROLES by coincidence, kept as its own constant", () => {
  const authSource = readFileSync("src/services/authorization.service-core.ts", "utf8");
  assert.match(
    authSource,
    /export const MY_PROSPECTS_ROLES: UserRole\[\] = \["ADMIN", "MANAGER"\];/,
  );
});

test("a denied (COMMERCIAL) visitor is redirected to /dashboard's role-aware router, not a hardcoded guess at their home", () => {
  const source = readFileSync("app/admin/my-prospects/page.tsx", "utf8");

  assert.match(
    source,
    /redirect\(error\.code === "UNAUTHENTICATED" \? "\/login" : "\/dashboard"\)/,
  );
});

test("authorization runs before any prospect data is fetched", () => {
  const source = readFileSync("app/admin/my-prospects/page.tsx", "utf8");

  const authorizeIndex = source.indexOf("requireMyProspectsAccess()");
  const fetchIndex = source.indexOf("getAdminMyProspects(");

  assert.ok(authorizeIndex >= 0, "requireMyProspectsAccess() call not found");
  assert.ok(fetchIndex >= 0, "getAdminMyProspects(...) call not found");
  assert.ok(authorizeIndex < fetchIndex);
});

test("the list query is scoped by the authenticated actor's own id, never a client-supplied owner identity (Ticket 21B item 12 — no ?userId=/ownerId=/commercialId= bypass)", () => {
  const source = readFileSync("app/admin/my-prospects/page.tsx", "utf8");

  assert.match(source, /getAdminMyProspects\(admin\.id, filters\)/);
  assert.doesNotMatch(source, /params\.userId/);
  assert.doesNotMatch(source, /params\.ownerId/);
  assert.doesNotMatch(source, /params\.commercialId/);
  assert.doesNotMatch(source, /params\.assignedUserId/);
  assert.doesNotMatch(source, /filters\.userId/);
});

test("the KPI query is scoped by the authenticated actor's own id", () => {
  const source = readFileSync("app/admin/my-prospects/page.tsx", "utf8");

  assert.match(source, /getAdminMyProspectsKpis\(admin\.id\)/);
});
