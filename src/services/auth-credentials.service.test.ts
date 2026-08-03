import assert from "node:assert/strict";
import test from "node:test";
import type { UserRole } from "@prisma/client";

import {
  authenticateCore,
  type CredentialUserRecord,
} from "./auth-credentials.service-core";

test("valid login returns the identity without the password hash", async () => {
  const user = makeUser("COMMERCIAL");

  const identity = await authenticateCore("awa@relais.test", "correct-password", {
    findUserByEmail: async (email) => {
      assert.equal(email, "awa@relais.test");
      return user;
    },
    compare: async (password, passwordHash) => {
      assert.equal(password, "correct-password");
      assert.equal(passwordHash, "hashed-value");
      return true;
    },
  });

  assert.deepEqual(identity, {
    id: "user-1",
    firstName: "Awa",
    lastName: "Traoré",
    role: "COMMERCIAL",
  });
  assert.equal((identity as { passwordHash?: unknown }).passwordHash, undefined);
});

test("invalid password returns null", async () => {
  const identity = await authenticateCore("awa@relais.test", "wrong-password", {
    findUserByEmail: async () => makeUser("COMMERCIAL"),
    compare: async () => false,
  });

  assert.equal(identity, null);
});

test("unknown email returns null without calling compare", async () => {
  let compareCalled = false;

  const identity = await authenticateCore("missing@relais.test", "anything", {
    findUserByEmail: async () => null,
    compare: async () => {
      compareCalled = true;
      return true;
    },
  });

  assert.equal(identity, null);
  assert.equal(compareCalled, false);
});

test("inactive user returns null even with the correct password", async () => {
  const identity = await authenticateCore("awa@relais.test", "correct-password", {
    findUserByEmail: async () => makeUser("COMMERCIAL", false),
    compare: async () => true,
  });

  assert.equal(identity, null);
});

test("user with no password set returns null without calling compare", async () => {
  let compareCalled = false;

  const identity = await authenticateCore("awa@relais.test", "anything", {
    findUserByEmail: async () => makeUser("COMMERCIAL", true, null),
    compare: async () => {
      compareCalled = true;
      return true;
    },
  });

  assert.equal(identity, null);
  assert.equal(compareCalled, false);
});

function makeUser(
  role: UserRole,
  active = true,
  passwordHash: string | null = "hashed-value",
): CredentialUserRecord {
  return {
    id: "user-1",
    firstName: "Awa",
    lastName: "Traoré",
    role,
    active,
    passwordHash,
  };
}
