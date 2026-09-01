import assert from "node:assert/strict";
import test from "node:test";

import {
  computeDailyTaskProgress,
  formatLongWorkDateWithWeekday,
  formatMinutesAsTime,
  groupDailyTasksForDisplay,
  resolveWorkdayDisplayState,
  sortDailyTasksForDisplay,
} from "./daily-work-presentation";
import type { DailyTaskRecord } from "@/src/services/daily-task.service-core";

function makeTask(overrides: Partial<DailyTaskRecord> = {}): DailyTaskRecord {
  return {
    id: "task-1",
    workDate: new Date("2026-09-01T00:00:00.000Z"),
    assignedToUserId: "emp-1",
    assignedByUserId: "mgr-1",
    content: "Relancer les écoles",
    assignedAt: new Date("2026-09-01T09:00:00.000Z"),
    status: "OPEN",
    completedAt: null,
    cancellationReason: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// resolveWorkdayDisplayState
// ---------------------------------------------------------------------------

test("resolveWorkdayDisplayState: null workday is NOT_STARTED", () => {
  assert.equal(resolveWorkdayDisplayState(null), "NOT_STARTED");
});

test("resolveWorkdayDisplayState: started, unconfirmed, not ended", () => {
  assert.equal(
    resolveWorkdayDisplayState({ confirmedAt: null, endedAt: null }),
    "STARTED_UNCONFIRMED",
  );
});

test("resolveWorkdayDisplayState: started, confirmed, not ended", () => {
  assert.equal(
    resolveWorkdayDisplayState({ confirmedAt: new Date(), endedAt: null }),
    "STARTED_CONFIRMED",
  );
});

test("resolveWorkdayDisplayState: ended, unconfirmed — a valid, non-alarming terminal state", () => {
  assert.equal(
    resolveWorkdayDisplayState({ confirmedAt: null, endedAt: new Date() }),
    "ENDED_UNCONFIRMED",
  );
});

test("resolveWorkdayDisplayState: ended, confirmed", () => {
  assert.equal(
    resolveWorkdayDisplayState({ confirmedAt: new Date(), endedAt: new Date() }),
    "ENDED_CONFIRMED",
  );
});

// ---------------------------------------------------------------------------
// formatMinutesAsTime
// ---------------------------------------------------------------------------

test("formatMinutesAsTime: 480 -> 08:00, 1020 -> 17:00", () => {
  assert.equal(formatMinutesAsTime(480), "08:00");
  assert.equal(formatMinutesAsTime(1020), "17:00");
});

test("formatMinutesAsTime: pads single-digit hours and minutes", () => {
  assert.equal(formatMinutesAsTime(5), "00:05");
  assert.equal(formatMinutesAsTime(9 * 60 + 5), "09:05");
});

// ---------------------------------------------------------------------------
// sortDailyTasksForDisplay / groupDailyTasksForDisplay
// ---------------------------------------------------------------------------

test("sortDailyTasksForDisplay: OPEN before COMPLETED before CANCELLED", () => {
  const tasks = [
    makeTask({ id: "c", status: "CANCELLED" }),
    makeTask({ id: "b", status: "COMPLETED" }),
    makeTask({ id: "a", status: "OPEN" }),
  ];

  const sorted = sortDailyTasksForDisplay(tasks);
  assert.deepEqual(
    sorted.map((task) => task.status),
    ["OPEN", "COMPLETED", "CANCELLED"],
  );
});

test("sortDailyTasksForDisplay: within a status group, ascending assignedAt order", () => {
  const tasks = [
    makeTask({ id: "later", assignedAt: new Date("2026-09-01T14:00:00.000Z") }),
    makeTask({ id: "earlier", assignedAt: new Date("2026-09-01T09:00:00.000Z") }),
  ];

  const sorted = sortDailyTasksForDisplay(tasks);
  assert.deepEqual(
    sorted.map((task) => task.id),
    ["earlier", "later"],
  );
});

test("sortDailyTasksForDisplay: stable id tie-break when assignedAt is identical — never reshuffles between renders", () => {
  const sameTime = new Date("2026-09-01T09:00:00.000Z");
  const tasks = [
    makeTask({ id: "b", assignedAt: sameTime }),
    makeTask({ id: "a", assignedAt: sameTime }),
  ];

  const first = sortDailyTasksForDisplay(tasks).map((t) => t.id);
  const second = sortDailyTasksForDisplay(tasks).map((t) => t.id);
  assert.deepEqual(first, second);
  assert.deepEqual(first, ["a", "b"]);
});

test("computeDailyTaskProgress: excludes CANCELLED from the denominator (27A §47)", () => {
  const tasks = [
    makeTask({ status: "COMPLETED" }),
    makeTask({ status: "COMPLETED" }),
    makeTask({ status: "OPEN" }),
    makeTask({ status: "CANCELLED" }),
  ];

  const progress = computeDailyTaskProgress(tasks);
  assert.deepEqual(progress, { completed: 2, total: 3 });
});

test("computeDailyTaskProgress: zero tasks is zero of zero, not a divide-by-zero artifact", () => {
  assert.deepEqual(computeDailyTaskProgress([]), { completed: 0, total: 0 });
});

test("groupDailyTasksForDisplay: separates active from cancelled, and computes progress from active only", () => {
  const tasks = [
    makeTask({ id: "open", status: "OPEN" }),
    makeTask({ id: "done", status: "COMPLETED" }),
    makeTask({ id: "cancelled", status: "CANCELLED" }),
  ];

  const { active, cancelled, progress } = groupDailyTasksForDisplay(tasks);
  assert.deepEqual(active.map((t) => t.id), ["open", "done"]);
  assert.deepEqual(cancelled.map((t) => t.id), ["cancelled"]);
  assert.deepEqual(progress, { completed: 1, total: 2 });
});

// ---------------------------------------------------------------------------
// formatLongWorkDateWithWeekday
// ---------------------------------------------------------------------------

test("formatLongWorkDateWithWeekday: capitalized French weekday + long date", () => {
  const result = formatLongWorkDateWithWeekday(new Date("2026-09-01T00:00:00.000Z"));
  assert.equal(result, "Mardi 1 septembre 2026");
});
