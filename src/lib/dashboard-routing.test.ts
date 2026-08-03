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
