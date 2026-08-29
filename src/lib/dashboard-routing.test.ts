import assert from "node:assert/strict";
import test from "node:test";

import { resolveDashboardRedirect } from "./dashboard-routing";

test("ADMIN is routed to /admin", () => {
  assert.equal(resolveDashboardRedirect("ADMIN"), "/admin");
});

test("MANAGER is routed to /admin", () => {
  assert.equal(resolveDashboardRedirect("MANAGER"), "/admin");
});

test("COMMERCIAL is routed to /dashboard/commercial", () => {
  assert.equal(resolveDashboardRedirect("COMMERCIAL"), "/dashboard/commercial");
});

test("Ticket 25N: ASSISTANT is now routed to /finances, its real operational workspace — replacing 25M's transitional /profile landing, never falling through to /admin (which would reject and bounce to the public homepage)", () => {
  assert.equal(resolveDashboardRedirect("ASSISTANT"), "/finances");
});
