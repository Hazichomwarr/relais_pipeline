import assert from "node:assert/strict";
import test from "node:test";

import { getResponsibleUserDisplay } from "./prospect-responsible-display";

test("an assigned, active user is represented with name, role, and active:true", () => {
  const display = getResponsibleUserDisplay({
    assignedUserId: "user-1",
    assignedUser: {
      firstName: "Jean",
      lastName: "Ouédraogo",
      role: "COMMERCIAL",
      active: true,
    },
  });

  assert.deepEqual(display, {
    assigned: true,
    userId: "user-1",
    name: "Jean Ouédraogo",
    role: "COMMERCIAL",
    active: true,
  });
});

test("an assigned but inactive user is represented truthfully, active:false — never hidden or treated as unassigned", () => {
  const display = getResponsibleUserDisplay({
    assignedUserId: "user-1",
    assignedUser: {
      firstName: "Jean",
      lastName: "Ouédraogo",
      role: "COMMERCIAL",
      active: false,
    },
  });

  assert.equal(display.assigned, true);
  if (display.assigned) {
    assert.equal(display.active, false);
  }
});

test("a role-changed (e.g. now ASSISTANT) current owner is still represented as the real current assignee — this helper never rewrites ownership", () => {
  const display = getResponsibleUserDisplay({
    assignedUserId: "user-1",
    assignedUser: {
      firstName: "Jean",
      lastName: "Ouédraogo",
      role: "ASSISTANT",
      active: true,
    },
  });

  assert.equal(display.assigned, true);
  if (display.assigned) {
    assert.equal(display.role, "ASSISTANT");
  }
});

test("a null assignedUserId is represented as unassigned, never falling back to agentName or any other text", () => {
  const display = getResponsibleUserDisplay({
    assignedUserId: null,
    assignedUser: null,
  });

  assert.deepEqual(display, { assigned: false });
});

test("a defensive mismatch (assignedUserId set but assignedUser relation missing) is treated as unassigned, never a crash", () => {
  const display = getResponsibleUserDisplay({
    assignedUserId: "user-1",
    assignedUser: null,
  });

  assert.deepEqual(display, { assigned: false });
});
