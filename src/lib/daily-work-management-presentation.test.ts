import assert from "node:assert/strict";
import test from "node:test";

import {
  getWorkdayStateLabel,
  resolveDefaultSelectedAgentId,
  sortAgentsForManagement,
} from "./daily-work-management-presentation";
import type { DailyWorkAgent } from "@/src/services/daily-work-management.service-core";
import type { WorkdayRecord } from "@/src/services/workday.service-core";

function makeWorkday(overrides: Partial<WorkdayRecord> = {}): WorkdayRecord {
  return {
    id: "workday-1",
    employeeUserId: "user-1",
    workDate: new Date("2026-09-01T00:00:00.000Z"),
    expectedStartTime: 480,
    expectedEndTime: 1020,
    startedAt: new Date("2026-09-01T07:57:00.000Z"),
    confirmedAt: null,
    confirmedByUserId: null,
    endedAt: null,
    ...overrides,
  };
}

function makeAgent(overrides: Partial<DailyWorkAgent> = {}): DailyWorkAgent {
  return {
    user: {
      id: "user-1",
      firstName: "Amidou",
      lastName: "Koané",
      role: "COMMERCIAL",
      active: true,
    },
    workday: null,
    tasks: [],
    canConfirmStart: false,
    canAssignTask: true,
    ...overrides,
  };
}

test("getWorkdayStateLabel: one distinct French label per state, never a raw enum-like value", () => {
  assert.equal(getWorkdayStateLabel("NOT_STARTED"), "Pas encore commencée");
  assert.equal(getWorkdayStateLabel("STARTED_UNCONFIRMED"), "En attente de confirmation");
  assert.equal(getWorkdayStateLabel("STARTED_CONFIRMED"), "Journée en cours");
  assert.equal(getWorkdayStateLabel("ENDED_UNCONFIRMED"), "Journée terminée");
  assert.equal(getWorkdayStateLabel("ENDED_CONFIRMED"), "Journée terminée");
});

test("sortAgentsForManagement: started+unconfirmed first, then started+confirmed, then not started, then ended", () => {
  const agents = [
    makeAgent({
      user: { id: "ended", firstName: "Z", lastName: "Z", role: "COMMERCIAL", active: true },
      workday: makeWorkday({ endedAt: new Date("2026-09-01T17:00:00.000Z"), confirmedAt: new Date() }),
    }),
    makeAgent({
      user: { id: "not-started", firstName: "Y", lastName: "Y", role: "COMMERCIAL", active: true },
      workday: null,
    }),
    makeAgent({
      user: { id: "unconfirmed", firstName: "X", lastName: "X", role: "COMMERCIAL", active: true },
      workday: makeWorkday({ confirmedAt: null }),
    }),
    makeAgent({
      user: { id: "confirmed", firstName: "W", lastName: "W", role: "COMMERCIAL", active: true },
      workday: makeWorkday({ confirmedAt: new Date("2026-09-01T08:10:00.000Z") }),
    }),
  ];

  const sorted = sortAgentsForManagement(agents);
  assert.deepEqual(
    sorted.map((a) => a.user.id),
    ["unconfirmed", "confirmed", "not-started", "ended"],
  );
});

test("sortAgentsForManagement: within the same state tier, stable alphabetical order by last/first name", () => {
  const agents = [
    makeAgent({ user: { id: "b", firstName: "Bernard", lastName: "Zongo", role: "COMMERCIAL", active: true } }),
    makeAgent({ user: { id: "a", firstName: "Awa", lastName: "Bazié", role: "COMMERCIAL", active: true } }),
  ];

  const sorted = sortAgentsForManagement(agents);
  assert.deepEqual(
    sorted.map((a) => a.user.id),
    ["a", "b"],
  );
});

test("resolveDefaultSelectedAgentId: prefers the first agent awaiting a confirmation action from the current actor", () => {
  const agents = [
    makeAgent({ user: { id: "first", firstName: "A", lastName: "A", role: "COMMERCIAL", active: true }, canConfirmStart: false }),
    makeAgent({ user: { id: "awaiting", firstName: "B", lastName: "B", role: "COMMERCIAL", active: true }, canConfirmStart: true }),
  ];

  assert.equal(resolveDefaultSelectedAgentId(agents), "awaiting");
});

test("resolveDefaultSelectedAgentId: falls back to the first agent in the (already sorted) roster when nothing awaits confirmation", () => {
  const agents = [
    makeAgent({ user: { id: "first", firstName: "A", lastName: "A", role: "COMMERCIAL", active: true } }),
    makeAgent({ user: { id: "second", firstName: "B", lastName: "B", role: "COMMERCIAL", active: true } }),
  ];

  assert.equal(resolveDefaultSelectedAgentId(agents), "first");
});

test("resolveDefaultSelectedAgentId: null for an empty roster", () => {
  assert.equal(resolveDefaultSelectedAgentId([]), null);
});
