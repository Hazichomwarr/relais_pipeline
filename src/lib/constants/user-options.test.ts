import assert from "node:assert/strict";
import test from "node:test";

import { getUserRoleLabel } from "./user-options";

test("getUserRoleLabel maps every role to its French label", () => {
  assert.equal(getUserRoleLabel("ADMIN"), "Administrateur");
  assert.equal(getUserRoleLabel("MANAGER"), "Manager");
  assert.equal(getUserRoleLabel("COMMERCIAL"), "Commercial");
});

test("Ticket 25M §7/§23: ASSISTANT renders as the intentional French label \"Assistant\", never leaking the raw enum value", () => {
  assert.equal(getUserRoleLabel("ASSISTANT"), "Assistant");
});
