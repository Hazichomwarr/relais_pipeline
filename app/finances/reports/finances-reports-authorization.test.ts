import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * /finances/reports transitively imports next-auth (via app/finances/
 * layout.tsx's requireRole), so — like app/finances/finances-
 * authorization.test.ts — it can't be executed under plain node:test
 * outside Next's runtime. These assertions run against the source
 * directly instead.
 *
 * Authorization itself (requireRole("ADMIN","MANAGER"), COMMERCIAL/
 * anonymous redirects, no data fetched pre-auth) is already covered by
 * app/finances/finances-authorization.test.ts against the *shared*
 * app/finances/layout.tsx that gates every route under /finances,
 * including this one — it is not re-tested here.
 */
const source = readFileSync("app/finances/reports/page.tsx", "utf8");

test("the reports page relies on the shared /finances layout rather than a second auth check", () => {
  assert.doesNotMatch(source, /await requireRole\(/);
  assert.doesNotMatch(source, /await requireAdmin\(/);
});

test("the reports page reuses the Ticket 17C report service, never Prisma or duplicated arithmetic", () => {
  assert.match(source, /getFinancialReport\(/);
  assert.doesNotMatch(source, /prisma\./);
  assert.doesNotMatch(source, /\.sort\(/);
  assert.doesNotMatch(source, /Number\(/);
});

test("the reports page parses the query string through the Ticket 17C filter helper, never passing raw searchParams to the service", () => {
  assert.match(source, /parseFinancialReportFilter\(params\)/);
});

test("the reports page defaults to the current month when no period is requested", () => {
  assert.match(source, /: "month";/);
});

test("no create/reversal mutation controls exist on the reports page (read-only)", () => {
  assert.doesNotMatch(source, /createLedgerEntryAction/);
  assert.doesNotMatch(source, /reverseLedgerEntryAction/);
});

test("the /finances page links to /finances/reports (Voir les rapports)", () => {
  const financesPageSource = readFileSync("app/finances/page.tsx", "utf8");

  assert.match(financesPageSource, /href="\/finances\/reports"/);
  assert.match(financesPageSource, /Voir les rapports/);
});
