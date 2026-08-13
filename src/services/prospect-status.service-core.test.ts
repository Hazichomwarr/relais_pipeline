import assert from "node:assert/strict";
import test from "node:test";
import type { ProspectStatus } from "@prisma/client";

import { isTerminalProspectStatus } from "./prospect-status.service-core";

test("WON and LOST are terminal", () => {
  assert.equal(isTerminalProspectStatus("WON"), true);
  assert.equal(isTerminalProspectStatus("LOST"), true);
});

test("every other current ProspectStatus value is active (non-terminal)", () => {
  const activeStatuses: ProspectStatus[] = [
    "NEW",
    "TO_FOLLOW_UP",
    "CONTACTED",
    "QUALIFIED",
    "PROPOSAL_SENT",
  ];

  for (const status of activeStatuses) {
    assert.equal(
      isTerminalProspectStatus(status),
      false,
      `${status} should be active, not terminal`,
    );
  }
});
