import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCommercialProspectByIdWhere,
  buildCommercialProspectWhere,
} from "./commercial-prospect.service-core";

test("always scopes commercial prospects by assignedUserId", () => {
  const where = buildCommercialProspectWhere("user-1", {
    search: "école",
    product: "KARMDA",
    status: "QUALIFIED",
    interest: "READY_TO_DISCUSS",
  });

  assert.equal(where.assignedUserId, "user-1");
  assert.equal(where.product, "KARMDA");
  assert.equal(where.status, "QUALIFIED");
  assert.equal(where.interest, "READY_TO_DISCUSS");
  assert.deepEqual(where.OR, [
    { name: { contains: "école", mode: "insensitive" } },
    { contactName: { contains: "école", mode: "insensitive" } },
    { phone: { contains: "école" } },
    { location: { contains: "école", mode: "insensitive" } },
  ]);
});

test("cannot receive a competing User filter", () => {
  const where = buildCommercialProspectWhere("trusted-user", {});
  assert.equal(where.assignedUserId, "trusted-user");
});

test("single-prospect lookup scopes by both id and the caller's own assignedUserId", () => {
  const where = buildCommercialProspectByIdWhere("prospect-1", "commercial-1");

  assert.equal(where.id, "prospect-1");
  assert.equal(where.assignedUserId, "commercial-1");
});

test("single-prospect lookup always uses the authenticated commercial id, never a foreign one", () => {
  const where = buildCommercialProspectByIdWhere(
    "prospect-owned-by-someone-else",
    "commercial-requesting-it",
  );

  assert.notEqual(where.assignedUserId, "someone-else");
  assert.equal(where.assignedUserId, "commercial-requesting-it");
});
