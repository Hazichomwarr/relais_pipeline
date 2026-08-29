import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * /profile transitively imports next-auth (via requireAuthenticatedUser),
 * so — like app/admin/my-prospects/my-prospects-authorization.test.ts —
 * it can't be executed under plain node:test outside Next's runtime.
 * Asserted against the source.
 *
 * Ticket 25F: unlike every other multi-role shared route in this repo
 * (/actions, /updates), /profile is not gated by a role allow-list — it
 * authorizes any authenticated, active account, since changing your own
 * password is an identity-based capability, not a role-gated one.
 */

test("the /profile layout authorizes via requireAuthenticatedUser — identity-based, not a role allow-list", () => {
  const source = readFileSync("app/profile/layout.tsx", "utf8");

  assert.match(source, /requireAuthenticatedUser\(\)/);
  assert.doesNotMatch(source, /requireRole\(/);
  assert.doesNotMatch(source, /requireAdmin\(/);
  assert.doesNotMatch(source, /requireManager\(/);
  assert.doesNotMatch(source, /requireCommercial\(/);
});

test("an unauthenticated visitor to /profile is redirected to /login", () => {
  const source = readFileSync("app/profile/layout.tsx", "utf8");

  assert.match(source, /redirect\("\/login"\)/);
});

test("the /profile page re-verifies active status via assertActiveAccountAccess, without restricting by role", () => {
  const source = readFileSync("app/profile/page.tsx", "utf8");

  assert.match(source, /assertActiveAccountAccess\(user\.id\)/);
  assert.doesNotMatch(source, /user\.role\s*===/);
  assert.doesNotMatch(source, /requireRole\(/);
  assert.doesNotMatch(source, /requireAdmin\(/);
  assert.doesNotMatch(source, /requireCommercial\(/);
});

test("a deactivated account visiting /profile is redirected to /login, not shown a stale session", () => {
  const source = readFileSync("app/profile/page.tsx", "utf8");

  const authorizeIndex = source.indexOf("assertActiveAccountAccess(user.id)");
  const catchIndex = source.indexOf("instanceof AccountAccessError");
  const redirectIndex = source.indexOf('redirect("/login")');

  assert.ok(authorizeIndex >= 0);
  assert.ok(catchIndex > authorizeIndex);
  assert.ok(redirectIndex > catchIndex);
});

test("the shared /profile page never imports ADMIN user-management mutation actions or services — self-profile and employee management stay separate boundaries (Ticket 25F item 12)", () => {
  const source = readFileSync("app/profile/page.tsx", "utf8");

  assert.doesNotMatch(source, /user\.actions/);
  assert.doesNotMatch(source, /updateUserAction/);
  assert.doesNotMatch(source, /deactivateUserAction/);
  assert.doesNotMatch(source, /createUserAction/);
});

test("the /profile page never exposes the password hash — no field named passwordHash reaches the rendered props", () => {
  const source = readFileSync("app/profile/page.tsx", "utf8");

  assert.doesNotMatch(source, /passwordHash/);
});

test("Ticket 25M §20/§24: the shell decision is a binary COMMERCIAL-or-not check, so ASSISTANT falls into the AdminShell branch without a new explicit case — shell choice must not imply permission, only layout", () => {
  const source = readFileSync("app/profile/layout.tsx", "utf8");

  assert.match(source, /user\.role === "COMMERCIAL"/);
  assert.match(source, /<AdminShell activeItem="profile">/);
});
