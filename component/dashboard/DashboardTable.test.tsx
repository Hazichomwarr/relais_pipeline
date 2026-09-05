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

test("the notes column clamps long notes to 2 lines instead of stretching the row (Ticket 28A)", () => {
  const source = readFileSync("component/dashboard/DashboardTable.tsx", "utf8");

  const desktopNotesCell = source.match(
    /<td className="max-w-80 px-4 py-5 text-sm text-slate-600">[\s\S]*?<\/td>/,
  )?.[0];
  assert.ok(desktopNotesCell, "expected a notes <td> in the desktop table");
  assert.match(desktopNotesCell!, /line-clamp-2/);
  assert.match(desktopNotesCell!, /break-words/);

  const mobileNotesBlock = source.match(
    /\{prospect\.notes && \([\s\S]*?<\/p>\s*\)\}/,
  )?.[0];
  assert.ok(mobileNotesBlock, "expected a conditional notes block in the mobile card");
  assert.match(mobileNotesBlock!, /line-clamp-2/);
  assert.doesNotMatch(mobileNotesBlock!, /line-clamp-3/);
});

test("an empty prospect note falls back to a dash instead of an empty cell (Ticket 28A)", () => {
  const source = readFileSync("component/dashboard/DashboardTable.tsx", "utf8");

  assert.match(source, /prospect\.notes \? \(/);
  assert.match(source, /<span className="text-slate-400">—<\/span>/);
});
