import assert from "node:assert/strict";
import test from "node:test";

import {
  formatSharedFeedExactTimestamp,
  formatSharedFeedTimestamp,
} from "./shared-feed-timestamp";

const referenceDate = new Date("2026-08-08T12:00:00.000Z");

test("formatSharedFeedExactTimestamp renders the business-timezone French date and time", () => {
  assert.equal(
    formatSharedFeedExactTimestamp(new Date("2026-08-07T14:32:00.000Z")),
    "07 août 2026 · 14:32",
  );
});

test("formatSharedFeedTimestamp shows minutes for very recent items", () => {
  const occurredAt = new Date("2026-08-08T11:55:00.000Z");
  const result = formatSharedFeedTimestamp(occurredAt, referenceDate);

  assert.equal(result.display, "Il y a 5 min");
  assert.equal(result.iso, occurredAt.toISOString());
});

test("formatSharedFeedTimestamp shows hours between one hour and one day ago", () => {
  const occurredAt = new Date("2026-08-08T10:00:00.000Z");
  const result = formatSharedFeedTimestamp(occurredAt, referenceDate);

  assert.equal(result.display, "Il y a 2 h");
});

test("formatSharedFeedTimestamp shows 'À l’instant' for sub-minute freshness", () => {
  const occurredAt = new Date("2026-08-08T11:59:50.000Z");
  const result = formatSharedFeedTimestamp(occurredAt, referenceDate);

  assert.equal(result.display, "À l’instant");
});

test("formatSharedFeedTimestamp falls back to the exact date/time beyond 24 hours", () => {
  const occurredAt = new Date("2026-08-05T09:15:00.000Z");
  const result = formatSharedFeedTimestamp(occurredAt, referenceDate);

  assert.equal(result.display, "05 août 2026 · 09:15");
  assert.equal(result.display, result.exact);
});

test("formatSharedFeedTimestamp always exposes the exact timestamp, even when the display is relative", () => {
  const occurredAt = new Date("2026-08-08T11:55:00.000Z");
  const result = formatSharedFeedTimestamp(occurredAt, referenceDate);

  assert.equal(result.exact, "08 août 2026 · 11:55");
});

test("formatSharedFeedTimestamp never shows a negative relative time for clock skew", () => {
  const occurredAt = new Date("2026-08-08T12:05:00.000Z");
  const result = formatSharedFeedTimestamp(occurredAt, referenceDate);

  assert.equal(result.display, result.exact);
});

test("formatSharedFeedTimestamp is a pure function of its two Date inputs — same inputs, same output, safe for SSR/hydration", () => {
  const occurredAt = new Date("2026-08-08T11:00:00.000Z");
  const first = formatSharedFeedTimestamp(occurredAt, referenceDate);
  const second = formatSharedFeedTimestamp(occurredAt, referenceDate);

  assert.deepEqual(first, second);
});
