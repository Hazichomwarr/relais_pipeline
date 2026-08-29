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

test("Ticket 25R §16/§48: ASSISTANT is now routed to /admin — replacing 25N's transitional /finances landing, now that ASSISTANT has real dashboard-shell access (requireDashboardAccess) with its own minimal content", () => {
  assert.equal(resolveDashboardRedirect("ASSISTANT"), "/admin");
});
