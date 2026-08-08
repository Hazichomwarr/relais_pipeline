import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWonTransitionActivityData,
  isWonTransition,
} from "./prospect-won-transition.service-core";

test("isWonTransition is true only when the prospect crosses from a non-WON status into WON", () => {
  assert.equal(isWonTransition("QUALIFIED", "WON"), true);
  assert.equal(isWonTransition("NEW", "WON"), true);
});

test("isWonTransition is false when the prospect is already WON", () => {
  assert.equal(isWonTransition("WON", "WON"), false);
});

test("isWonTransition is false when the status change isn't a move to WON", () => {
  assert.equal(isWonTransition("QUALIFIED", "PROPOSAL_SENT"), false);
  assert.equal(isWonTransition("WON", "LOST"), false);
});

test("isWonTransition is false when no status change is submitted at all", () => {
  assert.equal(isWonTransition("QUALIFIED", undefined), false);
});

test("buildWonTransitionActivityData produces a system-generated activity, never inventing an actor", () => {
  const occurredAt = new Date("2026-08-08T09:00:00.000Z");
  const data = buildWonTransitionActivityData({
    prospectId: "prospect-1",
    occurredAt,
  });

  assert.deepEqual(data, {
    prospectId: "prospect-1",
    type: "WON_TRANSITION",
    summary: "Le prospect est devenu client (statut WON).",
    occurredAt,
    agentName: undefined,
  });
});

test("buildWonTransitionActivityData preserves the acting commercial's name when known", () => {
  const data = buildWonTransitionActivityData({
    prospectId: "prospect-1",
    occurredAt: new Date("2026-08-08T09:00:00.000Z"),
    agentName: "Julbert Serme",
  });

  assert.equal(data.agentName, "Julbert Serme");
});
