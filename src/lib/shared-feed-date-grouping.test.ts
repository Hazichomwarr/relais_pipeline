import assert from "node:assert/strict";
import test from "node:test";

import {
  getFeedDateGroupLabel,
  groupSharedFeedItemsByDate,
} from "./shared-feed-date-grouping";

const referenceDate = new Date("2026-08-08T12:00:00.000Z");

test("getFeedDateGroupLabel labels the current business day as Aujourd’hui", () => {
  assert.equal(
    getFeedDateGroupLabel(new Date("2026-08-08T06:00:00.000Z"), referenceDate),
    "Aujourd’hui",
  );
});

test("getFeedDateGroupLabel labels the previous business day as Hier", () => {
  assert.equal(
    getFeedDateGroupLabel(new Date("2026-08-07T23:00:00.000Z"), referenceDate),
    "Hier",
  );
});

test("getFeedDateGroupLabel labels older days with the full French date", () => {
  assert.equal(
    getFeedDateGroupLabel(new Date("2026-08-06T10:00:00.000Z"), referenceDate),
    "06 août 2026",
  );
});

function item(id: string, occurredAt: string) {
  return { id, occurredAt };
}

test("groupSharedFeedItemsByDate keeps same-day items together in a single group", () => {
  const items = [
    item("a", "2026-08-08T18:00:00.000Z"),
    item("b", "2026-08-08T09:00:00.000Z"),
  ];

  const groups = groupSharedFeedItemsByDate(items, referenceDate);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].label, "Aujourd’hui");
  assert.deepEqual(groups[0].items.map((i) => i.id), ["a", "b"]);
});

test("groupSharedFeedItemsByDate creates today, yesterday, and older groups in feed order without re-sorting", () => {
  const items = [
    item("today-1", "2026-08-08T10:00:00.000Z"),
    item("yesterday-1", "2026-08-07T20:00:00.000Z"),
    item("yesterday-2", "2026-08-07T08:00:00.000Z"),
    item("older-1", "2026-08-05T12:00:00.000Z"),
  ];

  const groups = groupSharedFeedItemsByDate(items, referenceDate);

  assert.deepEqual(
    groups.map((group) => group.label),
    ["Aujourd’hui", "Hier", "05 août 2026"],
  );
  assert.deepEqual(
    groups.map((group) => group.items.map((i) => i.id)),
    [["today-1"], ["yesterday-1", "yesterday-2"], ["older-1"]],
  );
});

test("groupSharedFeedItemsByDate never merges two non-adjacent same-day runs out of order (defends against a caller passing unsorted input)", () => {
  const items = [
    item("today-1", "2026-08-08T10:00:00.000Z"),
    item("yesterday-1", "2026-08-07T10:00:00.000Z"),
    item("today-2", "2026-08-08T09:00:00.000Z"),
  ];

  const groups = groupSharedFeedItemsByDate(items, referenceDate);

  assert.equal(groups.length, 3);
  assert.deepEqual(
    groups.map((group) => group.items.map((i) => i.id)),
    [["today-1"], ["yesterday-1"], ["today-2"]],
  );
});

test("groupSharedFeedItemsByDate returns no groups for an empty feed", () => {
  assert.deepEqual(groupSharedFeedItemsByDate([], referenceDate), []);
});
