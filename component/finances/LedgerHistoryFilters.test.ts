import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * LedgerHistoryFilters is a "use client" component built on
 * next/navigation's useRouter for the auto-navigating selects, which
 * can't run outside a mounted Next.js app router under plain node:test
 * (same constraint as LedgerEntryForm.tsx / ReverseLedgerEntryForm.tsx
 * in Ticket 17B). These assertions run against the source directly.
 */
const source = readFileSync("component/finances/LedgerHistoryFilters.tsx", "utf8");

test("renders Tous, Entrées, and Sorties as plain URL-driven tabs", () => {
  assert.match(source, /label="Tous"/);
  assert.match(source, /label="Entrées"/);
  assert.match(source, /label="Sorties"/);
  assert.match(source, /buildLedgerHistoryTypeUrl\("INFLOW"\)/);
  assert.match(source, /buildLedgerHistoryTypeUrl\("OUTFLOW"\)/);
  assert.match(source, /buildLedgerHistoryTypeUrl\(""\)/);
});

test("category options come from the type prop, reusing the 17A option lists, never duplicated", () => {
  assert.match(
    source,
    /type === "INFLOW"\s*\n\s*\? inflowCategoryOptions/,
  );
  assert.match(
    source,
    /import\s*\{[^}]*inflowCategoryOptions[^}]*outflowCategoryOptions[^}]*\}\s*from\s*"@\/src\/lib\/financial-ledger-options"/,
  );
});

test("category select is hidden entirely for Tous (no type)", () => {
  assert.match(source, /\{type && \(/);
});

test("product select uses getProductRequirementForCategory, never a hardcoded category list", () => {
  assert.match(
    source,
    /category &&\s*\n\s*getProductRequirementForCategory\(category\) !== "forbidden"/,
  );
});

test("product select uses the centralized RELAIS product options, not a duplicated label list", () => {
  assert.match(
    source,
    /import\s*\{\s*productOptions\s*\}\s*from\s*"@\/src\/lib\/constants\/prospect-options"/,
  );
  assert.match(source, /productOptions\.map\(/);
});

test("changing category always navigates through buildLedgerHistoryCategoryUrl (stale product cleanup)", () => {
  assert.match(source, /buildLedgerHistoryCategoryUrl\(\s*\n\s*type,/);
});

test("changing product always navigates through buildLedgerHistoryProductUrl", () => {
  assert.match(source, /buildLedgerHistoryProductUrl\(\s*\n\s*type,\s*\n\s*category,/);
});
