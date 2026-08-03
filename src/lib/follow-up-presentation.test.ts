import assert from "node:assert/strict";
import test from "node:test";

import {
  compareFollowUpPriority,
  getFollowUpLabel,
  getFollowUpQueueKpis,
  getOverdueDays,
  isFollowUpQueueCandidate,
  isOverdue,
  isToday,
  queuePriority,
} from "./follow-up-presentation";

const today = new Date("2026-08-03T12:00:00");

test("calculates overdue days by calendar day and renders French labels", () => {
  const yesterday = new Date("2026-08-02T23:30:00");
  const sameDay = new Date("2026-08-03T01:00:00");
  const tomorrow = new Date("2026-08-04T09:00:00");

  assert.equal(getOverdueDays(yesterday, today), 1);
  assert.equal(getOverdueDays(sameDay, today), 0);
  assert.equal(isOverdue(yesterday, today), true);
  assert.equal(isToday(sameDay, today), true);
  assert.equal(getFollowUpLabel(yesterday, today), "En retard de 1 jour");
  assert.equal(getFollowUpLabel(sameDay, today), "Aujourd’hui");
  assert.equal(getFollowUpLabel(tomorrow, today), "Demain");
});

test("prioritizes overdue, today, future, then undated follow-ups", () => {
  assert.equal(queuePriority(new Date("2026-08-02T10:00:00"), today), 0);
  assert.equal(queuePriority(new Date("2026-08-03T10:00:00"), today), 1);
  assert.equal(queuePriority(new Date("2026-08-04T10:00:00"), today), 2);
  assert.equal(queuePriority(null, today), 3);
});

test("includes due and TO_FOLLOW_UP prospects but excludes tomorrow and terminal statuses", () => {
  assert.equal(
    isFollowUpQueueCandidate(
      { status: "NEW", followUpDate: new Date("2026-08-03T18:00:00") },
      today,
    ),
    true,
  );
  assert.equal(
    isFollowUpQueueCandidate(
      { status: "QUALIFIED", followUpDate: new Date("2026-08-02T12:00:00") },
      today,
    ),
    true,
  );
  assert.equal(
    isFollowUpQueueCandidate(
      { status: "QUALIFIED", followUpDate: new Date("2026-08-04T12:00:00") },
      today,
    ),
    false,
  );
  assert.equal(
    isFollowUpQueueCandidate(
      { status: "TO_FOLLOW_UP", followUpDate: null },
      today,
    ),
    true,
  );
  assert.equal(
    isFollowUpQueueCandidate(
      { status: "WON", followUpDate: new Date("2026-08-01T12:00:00") },
      today,
    ),
    false,
  );
  assert.equal(
    isFollowUpQueueCandidate(
      { status: "LOST", followUpDate: new Date("2026-08-01T12:00:00") },
      today,
    ),
    false,
  );
});

test("sorts oldest follow-up first and newest creation second", () => {
  const items = [
    {
      id: "newer-same-date",
      followUpDate: new Date("2026-08-02T12:00:00"),
      createdAt: new Date("2026-08-03T12:00:00"),
    },
    {
      id: "oldest",
      followUpDate: new Date("2026-08-01T12:00:00"),
      createdAt: new Date("2026-08-01T12:00:00"),
    },
    {
      id: "older-same-date",
      followUpDate: new Date("2026-08-02T12:00:00"),
      createdAt: new Date("2026-08-02T12:00:00"),
    },
    {
      id: "undated",
      followUpDate: null,
      createdAt: new Date("2026-08-04T12:00:00"),
    },
  ];

  items.sort(compareFollowUpPriority);
  assert.deepEqual(
    items.map((item) => item.id),
    ["oldest", "newer-same-date", "older-same-date", "undated"],
  );
});

test("computes queue KPIs from the filtered projection", () => {
  const kpis = getFollowUpQueueKpis(
    [
      {
        followUpDate: new Date("2026-08-02T12:00:00"),
        interest: "INTERESTED",
      },
      {
        followUpDate: new Date("2026-08-03T12:00:00"),
        interest: "READY_TO_DISCUSS",
      },
      {
        followUpDate: new Date("2026-08-08T12:00:00"),
        interest: "READY_TO_DISCUSS",
      },
      { followUpDate: null, interest: "MAYBE" },
    ],
    today,
  );

  assert.deepEqual(kpis, {
    dueToday: 4,
    overdue: 1,
    thisWeek: 2,
    readyToDiscuss: 2,
  });
});
