import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * DashboardTable renders DashboardFilters, which calls useRouter() — that
 * needs an app-router context renderToStaticMarkup doesn't provide, so
 * (like app/finances/*.test.ts) this asserts against the source instead.
 */
test("the desktop table has no oversized fixed min-width forcing horizontal overflow (Ticket 24B)", () => {
  const source = readFileSync("component/dashboard/DashboardTable.tsx", "utf8");

  assert.match(source, /<table/);
  assert.doesNotMatch(source, /min-w-300/);
});
