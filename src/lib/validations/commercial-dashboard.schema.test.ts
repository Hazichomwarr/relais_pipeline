import assert from "node:assert/strict";
import test from "node:test";

import { commercialDashboardSchema } from "./commercial-dashboard.schema";

test("requires a commercial userId", () => {
  assert.equal(commercialDashboardSchema.safeParse({}).success, false);
});

test("rejects an empty commercial userId", () => {
  assert.equal(commercialDashboardSchema.safeParse({ userId: "   " }).success, false);
});

test("trims a valid commercial userId", () => {
  assert.deepEqual(commercialDashboardSchema.parse({ userId: " user-1 " }), {
    userId: "user-1",
  });
});
