import assert from "node:assert/strict";
import test from "node:test";
import type { UserRole } from "@prisma/client";

import {
  assertCanChangePasswordCore,
  AuthorizationError,
  requireAuthenticatedUserCore,
  requireRoleCore,
  type AuthenticatedUser,
} from "./authorization.service-core";

test("requireAuthenticatedUserCore rejects an anonymous session", () => {
  assert.throws(
    () => requireAuthenticatedUserCore(null),
    hasCode("UNAUTHENTICATED"),
  );
});

test("requireAuthenticatedUserCore rejects a session with no user", () => {
  assert.throws(
    () => requireAuthenticatedUserCore({ user: null }),
    hasCode("UNAUTHENTICATED"),
  );
});

test("requireAuthenticatedUserCore returns the user, never the raw session", () => {
  const session = { user: makeUser("ADMIN") };
  const user = requireAuthenticatedUserCore(session);

  assert.equal(user, session.user);
});

test("requireRoleCore allows an ADMIN on an admin-only page", () => {
  const user = requireRoleCore({ user: makeUser("ADMIN") }, ["ADMIN", "MANAGER"]);
  assert.equal(user.role, "ADMIN");
});

test("requireRoleCore allows a MANAGER on an admin-only page", () => {
  const user = requireRoleCore({ user: makeUser("MANAGER") }, ["ADMIN", "MANAGER"]);
  assert.equal(user.role, "MANAGER");
});

test("requireRoleCore denies a COMMERCIAL on an admin-only page", () => {
  assert.throws(
    () => requireRoleCore({ user: makeUser("COMMERCIAL") }, ["ADMIN", "MANAGER"]),
    hasCode("ACCESS_DENIED"),
  );
});

test("requireRoleCore redirects (throws UNAUTHENTICATED, not ACCESS_DENIED) for an anonymous visitor", () => {
  assert.throws(
    () => requireRoleCore(null, ["ADMIN", "MANAGER"]),
    hasCode("UNAUTHENTICATED"),
  );
});

test("requireRoleCore strictly checks a single role for requireCommercial-style helpers", () => {
  assert.throws(
    () => requireRoleCore({ user: makeUser("ADMIN") }, ["COMMERCIAL"]),
    hasCode("ACCESS_DENIED"),
  );

  const user = requireRoleCore({ user: makeUser("COMMERCIAL") }, ["COMMERCIAL"]);
  assert.equal(user.role, "COMMERCIAL");
});

test("assertCanChangePasswordCore allows an ADMIN to change another user's password", () => {
  assert.doesNotThrow(() =>
    assertCanChangePasswordCore(makeUser("ADMIN"), "other-user"),
  );
});

test("assertCanChangePasswordCore denies a MANAGER changing another user's password", () => {
  assert.throws(
    () => assertCanChangePasswordCore(makeUser("MANAGER"), "other-user"),
    hasCode("ACCESS_DENIED"),
  );
});

test("assertCanChangePasswordCore allows any authenticated user to change their own password", () => {
  const user = makeUser("COMMERCIAL");
  assert.doesNotThrow(() => assertCanChangePasswordCore(user, user.id));
});

test("assertCanChangePasswordCore denies a COMMERCIAL changing another user's password", () => {
  assert.throws(
    () => assertCanChangePasswordCore(makeUser("COMMERCIAL"), "other-user"),
    hasCode("ACCESS_DENIED"),
  );
});

function hasCode(code: AuthorizationError["code"]) {
  return (error: unknown) =>
    error instanceof AuthorizationError && error.code === code;
}

function makeUser(role: UserRole): AuthenticatedUser {
  return {
    id: "user-1",
    firstName: "Awa",
    lastName: "Traoré",
    role,
  };
}
