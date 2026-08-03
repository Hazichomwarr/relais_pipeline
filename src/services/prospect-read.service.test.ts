import assert from "node:assert/strict";
import test from "node:test";

import { buildProspectWhere } from "./prospect-read.service-core";

test("filters assigned prospects by stable User ID", () => {
  const where = buildProspectWhere({ userId: "user-123" });

  assert.deepEqual(where, { assignedUserId: "user-123" });
  assert.equal("agentName" in where, false);
});

test("does not exclude unresolved historical prospects without a User filter", () => {
  const where = buildProspectWhere({ product: "KARMDA" });

  assert.deepEqual(where, { product: "KARMDA" });
  assert.equal("assignedUserId" in where, false);
});
