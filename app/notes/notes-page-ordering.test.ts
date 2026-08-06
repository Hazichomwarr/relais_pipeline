import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * Ticket 16B requires the notes list to preserve the service's ordering
 * (pinned DESC, updatedAt DESC, id DESC — see
 * comparePersonalNotesForListing in personal-note.service-core.ts) rather
 * than re-sorting client-side. Asserted against the source, the same
 * technique this repo already uses for authorization ordering (see
 * src/actions/authorization-order.test.ts) since this Server Component
 * transitively imports next-auth and can't run under plain node:test.
 */
test("the notes list page renders listMyPersonalNotes results directly, without re-sorting", () => {
  const source = readFileSync("app/notes/page.tsx", "utf8");

  assert.match(source, /listMyPersonalNotes\(user\.id\)/);
  assert.match(source, /notes\.map\(/);
  assert.doesNotMatch(source, /\.sort\(/);
});
