import assert from "node:assert/strict";
import test from "node:test";

import { presentCommercialPerformance } from "./commercial-performance.service-core";

test("computes commercial KPIs and pipeline without persistence", () => {
  const performance = presentCommercialPerformance({
    statusCounts: [
      { status: "NEW", count: 3 },
      { status: "QUALIFIED", count: 2 },
      { status: "WON", count: 3 },
      { status: "LOST", count: 1 },
    ],
    followUpsToday: 4,
    overdueProspects: 2,
    readyToDiscuss: 5,
  });

  assert.deepEqual(performance.kpis, {
    totalAssignedProspects: 9,
    followUpsToday: 4,
    overdueProspects: 2,
    qualifiedProspects: 2,
    wonProspects: 3,
    lostProspects: 1,
    readyToDiscuss: 5,
    conversionRate: 75,
  });
  assert.equal(
    performance.pipeline.find((item) => item.status === "QUALIFIED")?.count,
    2,
  );
});

test("returns a null conversion rate for a commercial with no closed prospects", () => {
  const performance = presentCommercialPerformance({
    statusCounts: [],
    followUpsToday: 0,
    overdueProspects: 0,
    readyToDiscuss: 0,
  });

  assert.equal(performance.kpis.totalAssignedProspects, 0);
  assert.equal(performance.kpis.conversionRate, null);
  assert.equal(performance.pipeline.length, 7);
});
