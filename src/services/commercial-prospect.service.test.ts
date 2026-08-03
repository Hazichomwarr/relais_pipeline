import assert from "node:assert/strict";
import test from "node:test";

import { buildCommercialProspectWhere } from "./commercial-prospect.service-core";

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
