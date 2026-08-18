import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * AdminShell and CommercialShell are async server components (AdminShell
 * reads the session via auth()), so — like app/finances/*.test.ts — these
 * assertions run against the source rather than rendering. The point of
 * this file (Ticket 24B) is structural: Container is the one shared
 * width/gutter primitive, embedded once in each dashboard shell, so no
 * future page has to remember to reach for it — and pages that used to
 * duplicate that responsibility have had the duplicate removed.
 */

test("AdminShell renders page content through the shared Container", () => {
  const source = readFileSync("component/dashboard/AdminShell.tsx", "utf8");

  assert.match(source, /from "@\/component\/layout\/Container"/);
  assert.match(source, /<Container>\{children\}<\/Container>/);
  assert.match(
    source,
    /min-w-0 flex-1/,
    "the shell must still establish the shrink-safety invariant, not just delegate width to Container",
  );
});

test("CommercialShell renders page content through the shared Container", () => {
  const source = readFileSync(
    "component/commercial/CommercialShell.tsx",
    "utf8",
  );

  assert.match(source, /from "@\/component\/layout\/Container"/);
  assert.match(source, /<Container>\{children\}<\/Container>/);
  assert.match(source, /min-w-0 flex-1/);
});

test("routes that pick AdminShell vs CommercialShell inline no longer re-wrap children in their own padded <main> (Ticket 24B)", () => {
  const files = [
    "app/products/page.tsx",
    "app/products/karmda/page.tsx",
    "app/products/lokari/page.tsx",
    "app/products/nia/page.tsx",
    "app/products/digital-services/page.tsx",
    "app/notes/layout.tsx",
    "app/actions/layout.tsx",
    "app/updates/layout.tsx",
    "app/reports/layout.tsx",
  ];

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(
      source,
      /<main className="px-4 py-6 sm:px-6 sm:py-8">/,
      `${file} should no longer duplicate the main/padding wrapper CommercialShell now owns`,
    );
  }
});

test("dashboard-style admin pages no longer impose their own redundant max-w wrapper now that AdminShell provides Container", () => {
  const files = [
    "app/admin/my-prospects/page.tsx",
    "app/admin/users/page.tsx",
    "app/admin/analytics/funnel/page.tsx",
    "app/admin/analytics/why/page.tsx",
    "app/actions/page.tsx",
    "app/notes/page.tsx",
    "app/finances/page.tsx",
    "app/finances/reports/page.tsx",
  ];

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(
      source,
      /mx-auto max-w-(5xl|6xl|7xl)/,
      `${file} should rely on the shell's Container for width, not its own max-w wrapper`,
    );
  }
});
