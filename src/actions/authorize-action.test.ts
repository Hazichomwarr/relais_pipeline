import assert from "node:assert/strict";
import test from "node:test";

import { AuthorizationError } from "@/src/services/authorization.service-core";

import { authorizeAction } from "./authorize-action";

test("returns ok with the resolved user when the check succeeds", async () => {
  const result = await authorizeAction(async () => ({ id: "user-1" }));

  assert.equal(result.ok, true);
  assert.equal(result.ok && result.user.id, "user-1");
});

test("converts an AuthorizationError into a controlled, non-throwing result", async () => {
  const result = await authorizeAction(async () => {
    throw new AuthorizationError("ACCESS_DENIED", "Accès refusé.");
  });

  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.message, "Accès refusé.");
});

test("never reaches the service call once authorization fails", async () => {
  let serviceCalled = false;

  const result = await authorizeAction(async () => {
    throw new AuthorizationError("UNAUTHENTICATED", "Non connecté.");
  });

  if (result.ok) {
    serviceCalled = true;
  }

  assert.equal(result.ok, false);
  assert.equal(serviceCalled, false);
});

test("rethrows unexpected errors instead of swallowing them as a controlled result", async () => {
  await assert.rejects(
    () =>
      authorizeAction(async () => {
        throw new Error("boom");
      }),
    /boom/,
  );
});
