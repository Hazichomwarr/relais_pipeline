import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { UserRole } from "@prisma/client";

import {
  authenticateCore,
  changeOwnPasswordCore,
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

test("changeOwnPasswordCore rejects a wrong current password without updating anything", async () => {
  let updateCalled = false;

  const result = await changeOwnPasswordCore("wrong-current", "new-secret1", {
    findPasswordHash: async () => "hashed-current",
    compare: async (password, hash) => {
      assert.equal(password, "wrong-current");
      assert.equal(hash, "hashed-current");
      return false;
    },
    updatePassword: async () => {
      updateCalled = true;
    },
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "CURRENT_PASSWORD_INVALID");
  }
  assert.equal(updateCalled, false);
});

test("changeOwnPasswordCore rejects when the user has no password hash set", async () => {
  let updateCalled = false;

  const result = await changeOwnPasswordCore("anything", "new-secret1", {
    findPasswordHash: async () => null,
    compare: async () => true,
    updatePassword: async () => {
      updateCalled = true;
    },
  });

  assert.equal(result.success, false);
  assert.equal(updateCalled, false);
});

test("changeOwnPasswordCore updates the password once the current one matches", async () => {
  let updatedWith: string | undefined;

  const result = await changeOwnPasswordCore("correct-current", "new-secret1", {
    findPasswordHash: async () => "hashed-current",
    compare: async () => true,
    updatePassword: async (newPassword) => {
      updatedWith = newPassword;
    },
  });

  assert.equal(result.success, true);
  assert.equal(updatedWith, "new-secret1");
});

/**
 * Ticket 25F: the self-service password-change capability must work
 * identically for every role. changeOwnPasswordCore doesn't even accept a
 * role — this proves the underlying workflow is structurally
 * role-independent, not merely untested for ADMIN/MANAGER, for each of
 * the three current roles.
 */
for (const role of ["ADMIN", "MANAGER", "COMMERCIAL"] as const) {
  test(`changeOwnPasswordCore updates the password for a ${role} account given the correct current password`, async () => {
    const user = makeUser(role);
    let updatedWith: string | undefined;

    const result = await changeOwnPasswordCore("correct-current", "new-secret1", {
      findPasswordHash: async () => user.passwordHash,
      compare: async (password, hash) => {
        assert.equal(password, "correct-current");
        assert.equal(hash, user.passwordHash);
        return true;
      },
      updatePassword: async (newPassword) => {
        updatedWith = newPassword;
      },
    });

    assert.equal(result.success, true);
    assert.equal(updatedWith, "new-secret1");
  });
}

test("changePassword (the real Prisma write behind changeOwnPassword) only ever touches passwordHash — never role, active, or dailyReportTemplateType", () => {
  const source = readFileSync("src/services/auth-credentials.service.ts", "utf8");
  const start = source.indexOf("export async function changePassword(");
  assert.ok(start >= 0, "changePassword function not found");

  const nextExportIndex = source.indexOf("\nexport ", start + 1);
  const functionBody =
    nextExportIndex === -1 ? source.slice(start) : source.slice(start, nextExportIndex);

  assert.match(functionBody, /data:\s*\{\s*passwordHash\s*\}/);
  assert.doesNotMatch(functionBody, /\brole\b/);
  assert.doesNotMatch(functionBody, /\bactive\b/);
  assert.doesNotMatch(functionBody, /dailyReportTemplateType/);
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
