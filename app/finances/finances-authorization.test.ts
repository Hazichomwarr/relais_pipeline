import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * The /finances routes transitively import next-auth (via
 * requireAuthenticatedUser/requireRole/requireAdmin), so — like
 * src/actions/authorization-order.test.ts and
 * app/notes/notes-authorization.test.ts — they can't be executed under
 * plain node:test outside Next's runtime. These assertions run against
 * the source directly instead.
 */

test("the finances layout gates read access to the Finance capability (Ticket 20G.1 — MANAGER lost the read access it had under Ticket 17B; Ticket 25N — ADMIN + ASSISTANT, not literal ADMIN identity)", () => {
  const source = readFileSync("app/finances/layout.tsx", "utf8");

  assert.match(source, /requireFinanceAccess\(\)/);
  assert.doesNotMatch(source, /requireAdmin\(\)/);
  assert.doesNotMatch(source, /requireRole\(/);
  assert.match(
    source,
    /error\.code === "UNAUTHENTICATED" \? "\/login" : "\/dashboard"/,
  );
});

test("the finances layout redirects before any ledger data is fetched", () => {
  const source = readFileSync("app/finances/layout.tsx", "utf8");

  assert.doesNotMatch(source, /getFinancialLedgerSummary\(/);
  assert.doesNotMatch(source, /listLedgerEntries\(/);
});

test("the finances dashboard reuses the Ticket 17A list service and the Ticket 23A effective summary service without re-sorting or recomputing", () => {
  const source = readFileSync("app/finances/page.tsx", "utf8");

  assert.match(source, /getEffectiveFinancialLedgerSummary\(/);
  assert.match(source, /listLedgerEntries\(/);
  assert.doesNotMatch(source, /\.sort\(/);
  assert.doesNotMatch(source, /prisma\./);
});

test("Ticket 25N: the finances dashboard shows create buttons for ADMIN or ASSISTANT — never trusted as authorization on its own", () => {
  const source = readFileSync("app/finances/page.tsx", "utf8");

  assert.match(
    source,
    /canCreate = user\.role === "ADMIN" \|\| user\.role === "ASSISTANT"/,
  );
  assert.match(source, /\{canCreate && \(/);
});

test("Ticket 25N: the create-entry page is gated by requireFinanceAccess, redirecting MANAGER/COMMERCIAL back to /finances", () => {
  const source = readFileSync("app/finances/new/page.tsx", "utf8");

  assert.match(source, /requireFinanceAccess\(\)/);
  assert.doesNotMatch(source, /requireAdmin\(\)/);
  assert.match(
    source,
    /redirect\(error\.code === "UNAUTHENTICATED" \? "\/login" : "\/finances"\)/,
  );
});

test("the create-entry page only accepts a trusted INFLOW/OUTFLOW type from the query string", () => {
  const source = readFileSync("app/finances/new/page.tsx", "utf8");

  assert.match(
    source,
    /params\.type !== "INFLOW" && params\.type !== "OUTFLOW"/,
  );
  assert.match(source, /redirect\("\/finances"\)/);
});

test("the create-entry page renders the shared LedgerEntryForm, not a duplicated inflow/outflow form", () => {
  const source = readFileSync("app/finances/new/page.tsx", "utf8");

  assert.match(source, /<LedgerEntryForm type={type} \/>/);
});

test("the ledger detail page calls notFound() for an unknown entry", () => {
  const source = readFileSync("app/finances/ledger/[entryId]/page.tsx", "utf8");

  assert.match(source, /getLedgerEntryById\(entryId\)/);
  assert.match(source, /if \(!entry\) \{\s*notFound\(\);/);
});

test("Ticket 25N: the ledger detail page offers reversal to ADMIN or ASSISTANT on a still-POSTED, non-reversal entry", () => {
  const source = readFileSync("app/finances/ledger/[entryId]/page.tsx", "utf8");

  assert.match(
    source,
    /canReverse =\s*\n\s*\(user\.role === "ADMIN" \|\| user\.role === "ASSISTANT"\) &&\s*\n\s*entry\.status === "POSTED" &&\s*\n\s*entry\.reversalOfId === null/,
  );
  assert.match(source, /\{canReverse && \(/);
});

test("the ledger detail page keeps a reversed original and its reversal both visible, with a link between them", () => {
  const source = readFileSync("app/finances/ledger/[entryId]/page.tsx", "utf8");

  assert.match(source, /entry\.reversalOfId/);
  assert.match(source, /entry\.reversedById/);
  assert.match(source, /href={`\/finances\/ledger\/\$\{entry\.reversalOfId\}`}/);
  assert.match(source, /href={`\/finances\/ledger\/\$\{entry\.reversedById\}`}/);
});

test("the ledger not-found page never leaks Prisma error details", () => {
  const source = readFileSync(
    "app/finances/ledger/[entryId]/not-found.tsx",
    "utf8",
  );

  assert.doesNotMatch(source, /prisma/i);
  assert.match(source, /Écriture introuvable/);
});
