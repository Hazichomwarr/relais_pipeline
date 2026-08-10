import assert from "node:assert/strict";
import test from "node:test";

import { buildAdminMyProspectsWhere } from "./admin-my-prospects.service-core";

test("scopes the where clause to the admin's own assignedUserId", () => {
  const where = buildAdminMyProspectsWhere("admin-1");

  assert.equal(where.assignedUserId, "admin-1");
});

test("a userId smuggled into the filters object is overridden by the actual admin id", () => {
  const spoofedFilters = { userId: "someone-else" } as unknown as Record<
    string,
    unknown
  >;
  const where = buildAdminMyProspectsWhere("admin-1", spoofedFilters);

  assert.equal(where.assignedUserId, "admin-1");
});

test("combines product and status filters with the ownership scope", () => {
  const where = buildAdminMyProspectsWhere("admin-1", {
    product: "KARMDA",
    status: "WON",
  });

  assert.equal(where.assignedUserId, "admin-1");
  assert.equal(where.product, "KARMDA");
  assert.equal(where.status, "WON");
});

test("search is applied via the shared OR clause, not filtered client-side", () => {
  const where = buildAdminMyProspectsWhere("admin-1", { search: "horizon" });

  assert.equal(where.assignedUserId, "admin-1");
  assert.ok(Array.isArray(where.OR));
  assert.ok(where.OR!.length > 0);
});
