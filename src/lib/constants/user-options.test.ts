import assert from "node:assert/strict";
import test from "node:test";

import { getUserRoleLabel } from "./user-options";

test("getUserRoleLabel maps every role to its French label", () => {
  assert.equal(getUserRoleLabel("ADMIN"), "Administrateur");
  assert.equal(getUserRoleLabel("MANAGER"), "Manager");
  assert.equal(getUserRoleLabel("COMMERCIAL"), "Commercial");
});
