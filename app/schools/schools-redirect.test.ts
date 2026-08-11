import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * /schools/page.tsx transitively imports next/navigation's redirect(), and
 * the layout above it imports next-auth, so — like the other *-*.test.ts
 * source-based checks in this repo — this can't run under plain node:test
 * outside Next's runtime. Asserted against the source.
 */

test("the legacy /schools route redirects to the canonical /products/karmda directory (Ticket 15G.1)", () => {
  const source = readFileSync("app/schools/page.tsx", "utf8");

  assert.match(source, /redirect\(`\/products\/karmda\$\{query\}`\)/);
});

test("the /schools redirect preserves an existing ?search= query parameter", () => {
  const source = readFileSync("app/schools/page.tsx", "utf8");

  assert.match(
    source,
    /params\.search\s*\n?\s*\?\s*`\?search=\$\{encodeURIComponent\(params\.search\)\}`/,
  );
});

test("the /schools layout still gates access — the redirect page itself does not re-authorize", () => {
  const layoutSource = readFileSync("app/schools/layout.tsx", "utf8");
  const pageSource = readFileSync("app/schools/page.tsx", "utf8");

  assert.match(layoutSource, /requireRole\("ADMIN", "MANAGER", "COMMERCIAL"\)/);
  assert.doesNotMatch(pageSource, /requireRole\(/);
});

test("/schools/[prospectId] is left untouched by the redirect — it still resolves its own school summary", () => {
  const source = readFileSync("app/schools/[prospectId]/page.tsx", "utf8");

  assert.match(source, /getSchoolSummaryById\(/);
});
