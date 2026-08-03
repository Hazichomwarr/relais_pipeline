import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPipeline,
  conversionRate,
  dashboardGreeting,
  followUpPriority,
  performanceColor,
  pipelinePercentage,
} from "./commercial-dashboard-presentation";

test("calculates conversion percentage and avoids division by zero", () => {
  assert.equal(conversionRate(3, 1), 75);
  assert.equal(conversionRate(0, 0), null);
});

test("calculates pipeline percentage safely", () => {
  assert.equal(pipelinePercentage(2, 8), 25);
  assert.equal(pipelinePercentage(0, 0), 0);
});

test("returns every pipeline status in workflow order", () => {
  const pipeline = buildPipeline({ NEW: 2, WON: 1 });

  assert.deepEqual(
    pipeline.map(({ status, count }) => ({ status, count })),
    [
      { status: "NEW", count: 2 },
      { status: "TO_FOLLOW_UP", count: 0 },
      { status: "CONTACTED", count: 0 },
      { status: "QUALIFIED", count: 0 },
      { status: "PROPOSAL_SENT", count: 0 },
      { status: "WON", count: 1 },
      { status: "LOST", count: 0 },
    ],
  );
  assert.equal(pipeline[0].percentage, (2 / 3) * 100);
});

test("maps performance and follow-up priority to presentation tones", () => {
  assert.equal(performanceColor(null), "neutral");
  assert.equal(performanceColor(70), "positive");
  assert.equal(performanceColor(40), "warning");
  assert.equal(performanceColor(10), "critical");
  assert.equal(followUpPriority(4), "overdue");
  assert.equal(followUpPriority(0), "today");
  assert.equal(followUpPriority(-1), "upcoming");
  assert.equal(followUpPriority(null), "undated");
});

test("builds a time-aware dashboard greeting", () => {
  assert.equal(
    dashboardGreeting("Awa", new Date("2026-08-03T09:00:00")),
    "Bonjour, Awa",
  );
  assert.equal(
    dashboardGreeting("Awa", new Date("2026-08-03T19:00:00")),
    "Bonsoir, Awa",
  );
});
