import assert from "node:assert/strict";
import test from "node:test";
import type { InterestLevel, ProspectStatus } from "@prisma/client";

import {
  computeReadyToDiscussSummary,
  isInterestedProspect,
  isReadyToDiscussProspect,
  isTerminalProspectStatus,
} from "./prospect-status.service-core";

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

test("isReadyToDiscussProspect (Ticket 25E) matches only the structured READY_TO_DISCUSS value", () => {
  assert.equal(isReadyToDiscussProspect("READY_TO_DISCUSS"), true);

  const notReadyToDiscuss: InterestLevel[] = [
    "NOT_INTERESTED",
    "MAYBE",
    "NEEDS_INFORMATION",
    "INTERESTED",
  ];
  for (const level of notReadyToDiscuss) {
    assert.equal(
      isReadyToDiscussProspect(level),
      false,
      `${level} should not count as ready to discuss`,
    );
  }
});

test("computeReadyToDiscussSummary counts and percentages against the filtered population: 10 total, 3 READY_TO_DISCUSS -> 30%", () => {
  const prospects: { interest: InterestLevel }[] = [
    { interest: "READY_TO_DISCUSS" },
    { interest: "READY_TO_DISCUSS" },
    { interest: "READY_TO_DISCUSS" },
    { interest: "INTERESTED" },
    { interest: "INTERESTED" },
    { interest: "MAYBE" },
    { interest: "MAYBE" },
    { interest: "NEEDS_INFORMATION" },
    { interest: "NOT_INTERESTED" },
    { interest: "NOT_INTERESTED" },
  ];

  assert.equal(prospects.length, 10);

  const summary = computeReadyToDiscussSummary(prospects);
  assert.equal(summary.count, 3);
  assert.equal(summary.percentage, 30);
});

test("computeReadyToDiscussSummary returns 0/0 for an empty filtered population, without NaN", () => {
  const summary = computeReadyToDiscussSummary([]);
  assert.equal(summary.count, 0);
  assert.equal(summary.percentage, 0);
  assert.ok(!Number.isNaN(summary.percentage));
});
