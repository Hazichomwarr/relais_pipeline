import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * The /updates routes transitively import next-auth (via
 * requireSharedFeedAccess), so — like app/notes/notes-authorization.test.ts
 * and app/finances/finances-authorization.test.ts — they can't be executed
 * under plain node:test outside Next's runtime. Asserted against the
 * source directly instead.
 */

test("the updates layout gates on requireSharedFeedAccess (ADMIN/MANAGER/COMMERCIAL), not a narrower or public check", () => {
  const source = readFileSync("app/updates/layout.tsx", "utf8");

  assert.match(source, /requireSharedFeedAccess\(\)/);
  assert.doesNotMatch(source, /requireAdmin\(/);
  assert.doesNotMatch(source, /requireRole\(/);
  assert.match(source, /"\/login"/);
});

test("the updates page re-authorizes via requireSharedFeedAccess before fetching the feed", () => {
  const source = readFileSync("app/updates/page.tsx", "utf8");

  const authorizeIndex = source.indexOf("requireSharedFeedAccess()");
  const fetchIndex = source.indexOf("getSharedFeed(");

  assert.ok(authorizeIndex >= 0, "page must call requireSharedFeedAccess()");
  assert.ok(fetchIndex >= 0, "page must call getSharedFeed(");
  assert.ok(
    authorizeIndex < fetchIndex,
    "authorization must happen before the feed is fetched",
  );
  assert.match(source, /"\/login"/);
});

test("anonymous and unrecognized-role visitors are redirected, never shown a partial feed", () => {
  const layoutSource = readFileSync("app/updates/layout.tsx", "utf8");
  const pageSource = readFileSync("app/updates/page.tsx", "utf8");

  for (const source of [layoutSource, pageSource]) {
    assert.match(
      source,
      /redirect\(error\.code === "UNAUTHENTICATED" \? "\/login" : "\/"\)/,
    );
  }
});
