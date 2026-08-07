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
