import assert from "node:assert/strict";
import test from "node:test";
import type { UserRole } from "@prisma/client";

import {
  AccountAccessError,
  assertActiveAccountAccessCore,
  type AccountIdentity,
} from "./account-access.service-core";

test("rejects an unknown account with a controlled code", async () => {
  await assert.rejects(
    () => assertActiveAccountAccessCore("missing", async () => null),
    hasCode("ACCOUNT_NOT_FOUND"),
  );
});

test("rejects an inactive account with a controlled code", async () => {
  await assert.rejects(
    () =>
      assertActiveAccountAccessCore("user-1", async () =>
        makeUser("ADMIN", false),
      ),
    hasCode("ACCOUNT_INACTIVE"),
  );
});

for (const role of ["ADMIN", "MANAGER", "COMMERCIAL"] as const) {
  test(`accepts an active ${role} account — role makes no difference to self-account access (Ticket 25F)`, async () => {
    const user = await assertActiveAccountAccessCore("user-1", async (userId) => {
      assert.equal(userId, "user-1");
      return makeUser(role);
    });

    assert.equal(user.id, "user-1");
    assert.equal(user.role, role);
  });
}

function hasCode(code: AccountAccessError["code"]) {
  return (error: unknown) =>
    error instanceof AccountAccessError && error.code === code;
}

function makeUser(role: UserRole, active = true): AccountIdentity {
  return {
    id: "user-1",
    firstName: "Awa",
    lastName: "Traoré",
    email: "awa@relais.test",
    phone: null,
    role,
    active,
  };
}
