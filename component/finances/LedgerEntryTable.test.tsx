import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import LedgerEntryTable from "./LedgerEntryTable";
import type { LedgerEntryListItem } from "@/src/services/financial-ledger.service";

function entry(
  overrides: Partial<LedgerEntryListItem> = {},
): LedgerEntryListItem {
  return {
    id: "entry-1",
    type: "INFLOW",
    category: "CLIENT_PAYMENT",
    status: "POSTED",
    amount: "300000.00",
    currencyCode: "XOF",
    product: "KARMDA",
    counterpartyName: "Groupe scolaire Horizon",
    reason: "Premier versement annuel KARMDA",
    paymentMethod: "CASH",
    reference: null,
    occurredAt: new Date("2026-08-06T12:00:00"),
    createdByUserId: "user-1",
    createdByUserDisplayName: "Hamza Mare",
    reversalOfId: null,
    reversedById: null,
    createdAt: new Date("2026-08-06T12:00:00"),
    updatedAt: new Date("2026-08-06T12:00:00"),
    ...overrides,
  };
}

test("renders entries in the order given, without re-sorting", () => {
  const html = renderToStaticMarkup(
    <LedgerEntryTable
      entries={[
        entry({ id: "entry-1", counterpartyName: "École Horizon" }),
        entry({ id: "entry-2", counterpartyName: "École Aurore" }),
      ]}
    />,
  );

  assert.ok(html.indexOf("École Horizon") < html.indexOf("École Aurore"));
});

test("shows the creator's display name for each row", () => {
  const html = renderToStaticMarkup(
    <LedgerEntryTable entries={[entry({ createdByUserDisplayName: "Awa Traoré" })]} />,
  );

  assert.match(html, /Awa Traoré/);
});

test("omits product for entries with no product (e.g. FUEL)", () => {
  const html = renderToStaticMarkup(
    <LedgerEntryTable
      entries={[
        entry({
          type: "OUTFLOW",
          category: "FUEL",
          product: null,
          counterpartyName: "Julbert Serme",
        }),
      ]}
    />,
  );

  assert.doesNotMatch(html, /KARMDA/);
  assert.match(html, />—</);
});

test("links each row to its detail page", () => {
  const html = renderToStaticMarkup(
    <LedgerEntryTable entries={[entry({ id: "entry-42" })]} />,
  );

  assert.match(html, /href="\/finances\/ledger\/entry-42"/);
});

// --- Viewport-safe desktop table layout (Ticket 24B) -------------------

/**
 * Scoped to the <table>...</table> markup only — the mobile card view
 * (LedgerEntryCard) legitimately uses min-w-0/truncate for its own
 * narrow-viewport layout and is out of scope for the desktop table fix.
 */
function extractDesktopTableHtml(html: string): string {
  const start = html.indexOf("<table");
  const end = html.indexOf("</table>") + "</table>".length;
  return html.slice(start, end);
}

test("the desktop table has no oversized fixed min-width forcing horizontal overflow", () => {
  const html = renderToStaticMarkup(<LedgerEntryTable entries={[entry()]} />);
  const tableHtml = extractDesktopTableHtml(html);

  assert.doesNotMatch(
    tableHtml,
    /\bmin-w-(?!0\b)\S+/,
    "a fixed min-width on the table defeats table-fixed's proportional column sizing and forces desktop scrolling",
  );
});

test("the desktop table uses table-fixed with a colgroup distributing width across all 10 columns", () => {
  const html = renderToStaticMarkup(<LedgerEntryTable entries={[entry()]} />);
  const tableHtml = extractDesktopTableHtml(html);

  assert.match(tableHtml, /table-fixed/);
  const colMatches = tableHtml.match(/<col\b[^>]*>/g) ?? [];
  assert.equal(
    colMatches.length,
    10,
    "Date, Type, Montant, Catégorie, Produit, Tiers, Mode, Statut, Enregistré par, Voir",
  );
});

test("Tiers and Enregistré par are allowed to wrap instead of being truncated with an ellipsis", () => {
  const html = renderToStaticMarkup(
    <LedgerEntryTable
      entries={[
        entry({
          counterpartyName: "Groupe scolaire international Horizon et Aurore",
          createdByUserDisplayName: "Jean-Baptiste Ouédraogo-Compaoré",
        }),
      ]}
    />,
  );
  const tableHtml = extractDesktopTableHtml(html);

  assert.doesNotMatch(
    tableHtml,
    /truncate/,
    "long Tiers/Enregistré par values should wrap onto a second line, not be clipped with an ellipsis",
  );
  assert.match(tableHtml, /Groupe scolaire international Horizon et Aurore/);
  assert.match(tableHtml, /Jean-Baptiste Ouédraogo-Compaoré/);
});

test("whitespace-nowrap is not applied table-wide — only Montant, the one column that must never break mid-value", () => {
  const html = renderToStaticMarkup(<LedgerEntryTable entries={[entry()]} />);
  const tableHtml = extractDesktopTableHtml(html);

  const nowrapCount = (tableHtml.match(/whitespace-nowrap/g) ?? []).length;
  assert.equal(
    nowrapCount,
    1,
    "only the Montant cell should force whitespace-nowrap; Date, Mode, Tiers, and Enregistré par must be free to wrap",
  );
});
