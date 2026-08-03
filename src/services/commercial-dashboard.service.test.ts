import assert from "node:assert/strict";
import test from "node:test";

import type { CommercialIdentity } from "./commercial-access.service-core";
import { getCommercialDashboardCore } from "./commercial-dashboard.service-core";

const commercial: CommercialIdentity = {
  id: "commercial-1",
  firstName: "Awa",
  lastName: "Traoré",
  email: null,
  phone: null,
  role: "COMMERCIAL",
  active: true,
};
const today = new Date("2026-08-03T12:00:00");

test("composes a populated dashboard using the authorized commercial ID", async () => {
  const receivedIds: string[] = [];
  const dashboard = await getCommercialDashboardCore("commercial-1", today, {
    findCommercial: async () => commercial,
    getPerformance: async (userId) => {
      receivedIds.push(userId);
      return { kpis: { wonProspects: 1 }, pipeline: [{ status: "WON" }] };
    },
    getFollowUps: async (userId) => {
      receivedIds.push(userId);
      return [{ id: "follow-up-1", overdueDays: 2 }];
    },
    getRecentProspects: async (userId) => {
      receivedIds.push(userId);
      return [{ id: "prospect-1" }];
    },
  });

  assert.deepEqual(receivedIds, [
    "commercial-1",
    "commercial-1",
    "commercial-1",
  ]);
  assert.deepEqual(dashboard.kpis, { wonProspects: 1 });
  assert.deepEqual(dashboard.todaysFollowUps, [
    { id: "follow-up-1", overdueDays: 2 },
  ]);
  assert.deepEqual(dashboard.recentProspects, [{ id: "prospect-1" }]);
});

test("returns empty projections for a commercial with no prospects", async () => {
  const dashboard = await getCommercialDashboardCore("commercial-1", today, {
    findCommercial: async () => commercial,
    getPerformance: async () => ({
      kpis: { totalAssignedProspects: 0 },
      pipeline: [],
    }),
    getFollowUps: async () => [],
    getRecentProspects: async () => [],
  });

  assert.equal(dashboard.kpis.totalAssignedProspects, 0);
  assert.deepEqual(dashboard.todaysFollowUps, []);
  assert.deepEqual(dashboard.recentProspects, []);
});

test("does not run dashboard queries when commercial authorization fails", async () => {
  let queryCount = 0;

  await assert.rejects(
    () =>
      getCommercialDashboardCore("missing", today, {
        findCommercial: async () => null,
        getPerformance: async () => {
          queryCount += 1;
          return { kpis: {}, pipeline: [] };
        },
        getFollowUps: async () => {
          queryCount += 1;
          return [];
        },
        getRecentProspects: async () => {
          queryCount += 1;
          return [];
        },
      }),
    /Ce commercial n’existe pas/,
  );

  assert.equal(queryCount, 0);
});
