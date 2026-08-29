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

test("Ticket 25M §19/§20: ASSISTANT is routed to /profile, never falling through to /admin (which would reject and bounce to the public homepage)", () => {
  assert.equal(resolveDashboardRedirect("ASSISTANT"), "/profile");
});
