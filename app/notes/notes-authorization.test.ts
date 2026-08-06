import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * The /notes routes transitively import next-auth (via
 * requireAuthenticatedUser), so — like src/actions/authorization-order.test.ts
 * — they can't be executed under plain node:test outside Next's runtime.
 * This asserts the required structure directly against the source instead.
 */
test("the notes layout gates on authentication alone (every role manages only their own notes)", () => {
  const source = readFileSync("app/notes/layout.tsx", "utf8");

  assert.match(source, /requireAuthenticatedUser\(\)/);
  assert.doesNotMatch(source, /requireRole\(/);
  assert.doesNotMatch(source, /requireAdmin\(/);
  assert.match(source, /redirect\("\/login"\)/);
});

test("the notes list page scopes its query to the authenticated user's id", () => {
  const source = readFileSync("app/notes/page.tsx", "utf8");

  assert.match(source, /requireAuthenticatedUser\(\)/);
  assert.match(source, /listMyPersonalNotes\(user\.id\)/);
  assert.match(source, /redirect\("\/login"\)/);
});

test("the note detail page scopes its lookup to the authenticated user's id and calls notFound() when absent", () => {
  const source = readFileSync("app/notes/[noteId]/page.tsx", "utf8");

  assert.match(source, /requireAuthenticatedUser\(\)/);
  assert.match(source, /getMyPersonalNoteById\(user\.id, noteId\)/);
  assert.match(source, /if \(!note\) \{\s*notFound\(\);/);
});

test("the create-note page requires authentication before rendering the form", () => {
  const source = readFileSync("app/notes/new/page.tsx", "utf8");

  assert.match(source, /requireAuthenticatedUser\(\)/);
  assert.match(source, /redirect\("\/login"\)/);
});

test("the note detail route has a dedicated not-found page with no ownership-revealing copy", () => {
  const source = readFileSync("app/notes/[noteId]/not-found.tsx", "utf8");

  assert.doesNotMatch(source, /appartient à un autre utilisateur/i);
});
