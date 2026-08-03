import assert from "node:assert/strict";
import test from "node:test";
import type { UserRole } from "@prisma/client";

import {
  assertCommercialAccessCore,
  CommercialAccessError,
  type CommercialIdentity,
} from "./commercial-access.service-core";

test("rejects an unknown commercial with a controlled code", async () => {
  await assert.rejects(
    () => assertCommercialAccessCore("missing", async () => null),
    hasCode("COMMERCIAL_NOT_FOUND"),
  );
});

test("rejects an inactive commercial with a controlled code", async () => {
  await assert.rejects(
    () =>
      assertCommercialAccessCore("user-1", async () =>
        makeUser("COMMERCIAL", false),
      ),
    hasCode("COMMERCIAL_INACTIVE"),
  );
});

for (const role of ["ADMIN", "MANAGER"] as const) {
  test(`rejects a ${role} User`, async () => {
    await assert.rejects(
      () =>
        assertCommercialAccessCore("user-1", async () => makeUser(role)),
      hasCode("USER_NOT_COMMERCIAL"),
    );
  });
}

test("accepts an active COMMERCIAL User", async () => {
  const user = await assertCommercialAccessCore(" user-1 ", async (userId) => {
    assert.equal(userId, "user-1");
    return makeUser("COMMERCIAL");
  });

  assert.equal(user.id, "user-1");
});

function hasCode(code: CommercialAccessError["code"]) {
  return (error: unknown) =>
    error instanceof CommercialAccessError && error.code === code;
}

function makeUser(role: UserRole, active = true): CommercialIdentity {
  return {
    id: "user-1",
    firstName: "Awa",
    lastName: "Traoré",
    email: null,
    phone: null,
    role,
    active,
  };
}
