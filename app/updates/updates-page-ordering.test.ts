import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * Ticket 18B requires the feed to preserve Ticket 18A's occurredAt DESC,
 * id DESC ordering exactly (no re-sorting in React), grouped by date
 * without reshuffling — the same source-inspection technique used by
 * app/notes/notes-page-ordering.test.ts, since this Server Component
 * transitively imports next-auth.
 */
test("the updates page renders getSharedFeed()'s result directly, without re-sorting", () => {
  const source = readFileSync("app/updates/page.tsx", "utf8");

  assert.match(source, /getSharedFeed\(\{ limit \}\)/);
  assert.doesNotMatch(source, /\.sort\(/);
  assert.doesNotMatch(source, /prisma\./);
});

test("SharedFeedList groups without re-sorting — it delegates to the order-preserving groupSharedFeedItemsByDate", () => {
  const source = readFileSync("component/updates/SharedFeedList.tsx", "utf8");

  assert.match(source, /groupSharedFeedItemsByDate\(/);
  assert.doesNotMatch(source, /\.sort\(/);
});

test("groupSharedFeedItemsByDate itself never re-sorts its input", () => {
  const source = readFileSync("src/lib/shared-feed-date-grouping.ts", "utf8");

  assert.doesNotMatch(source, /\.sort\(/);
});
