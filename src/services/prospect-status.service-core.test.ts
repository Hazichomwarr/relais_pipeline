import assert from "node:assert/strict";
import test from "node:test";
import type { InterestLevel, ProspectStatus } from "@prisma/client";

import { isInterestedProspect, isTerminalProspectStatus } from "./prospect-status.service-core";

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

test("isInterestedProspect matches the Ticket 15H.4 Admin dashboard definition exactly: INTERESTED and READY_TO_DISCUSS only", () => {
  assert.equal(isInterestedProspect("INTERESTED"), true);
  assert.equal(isInterestedProspect("READY_TO_DISCUSS"), true);

  const notInterested: InterestLevel[] = [
    "NOT_INTERESTED",
    "MAYBE",
    "NEEDS_INFORMATION",
  ];
  for (const level of notInterested) {
    assert.equal(isInterestedProspect(level), false, `${level} should not count as interested`);
  }
});
