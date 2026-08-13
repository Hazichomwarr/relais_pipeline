import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * The /actions routes transitively import next-auth (via
 * requireProspectActionQueueAccess), so — like
 * app/updates/updates-authorization.test.ts — they can't be executed
 * under plain node:test outside Next's runtime. Asserted against the
 * source directly instead.
 */

test("the actions layout gates on requireProspectActionQueueAccess (ADMIN/MANAGER/COMMERCIAL), not a narrower or public check", () => {
  const source = readFileSync("app/actions/layout.tsx", "utf8");

  assert.match(source, /requireProspectActionQueueAccess\(\)/);
  assert.doesNotMatch(source, /requireAdmin\(/);
  assert.doesNotMatch(source, /requireRole\(/);
  assert.doesNotMatch(source, /requireAuthenticatedUser\(/);
  assert.match(source, /"\/login"/);
});

test("the actions page re-authorizes via requireProspectActionQueueAccess before fetching the queue", () => {
  const source = readFileSync("app/actions/page.tsx", "utf8");

  const authorizeIndex = source.indexOf("requireProspectActionQueueAccess()");
  const fetchIndex = source.indexOf("listProspectActionQueue(");

  assert.ok(authorizeIndex >= 0, "page must call requireProspectActionQueueAccess()");
  assert.ok(fetchIndex >= 0, "page must call listProspectActionQueue(");
  assert.ok(
    authorizeIndex < fetchIndex,
    "authorization must happen before the queue is fetched",
  );
  assert.match(source, /"\/login"/);
});

test("anonymous and unrecognized-role visitors are redirected, never shown a partial queue", () => {
  const layoutSource = readFileSync("app/actions/layout.tsx", "utf8");
  const pageSource = readFileSync("app/actions/page.tsx", "utf8");

  for (const source of [layoutSource, pageSource]) {
    assert.match(
      source,
      /redirect\(error\.code === "UNAUTHENTICATED" \? "\/login" : "\/"\)/,
    );
  }
});

test("the company-wide crack-detection query is never invoked for a COMMERCIAL viewer", () => {
  const source = readFileSync("app/actions/page.tsx", "utf8");

  assert.match(
    source,
    /user\.role === "COMMERCIAL"\s*\n?\s*\?\s*Promise\.resolve\(\[\]\)\s*\n?\s*:\s*listActiveProspectsWithoutOpenAction\(user\)/,
  );
  assert.match(source, /user\.role !== "COMMERCIAL" &&/);
});

test("authorization.service-core.ts defines PROSPECT_ACTION_QUEUE_ROLES as its own constant, not an alias of an unrelated feature's role list", () => {
  const source = readFileSync("src/services/authorization.service-core.ts", "utf8");

  assert.match(
    source,
    /export const PROSPECT_ACTION_QUEUE_ROLES: UserRole\[\] = \[\s*"ADMIN",\s*"MANAGER",\s*"COMMERCIAL",?\s*\];/,
  );
});
