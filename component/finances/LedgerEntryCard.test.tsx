import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import LedgerEntryCard from "./LedgerEntryCard";
import type { LedgerEntryListItem } from "@/src/services/financial-ledger.service";

function baseEntry(
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

test("inflow card shows a plus-prefixed amount, category, product and counterparty", () => {
  const html = renderToStaticMarkup(<LedgerEntryCard entry={baseEntry()} />);

  assert.match(html, /\+ 300 000 CFA/);
  assert.match(html, /Paiement client/);
  assert.match(html, /KARMDA/);
  assert.match(html, /Groupe scolaire Horizon/);
  assert.match(html, /Reçu de/);
  assert.match(html, /Espèces/);
  assert.match(html, /06 août 2026/);
  assert.match(html, /href="\/finances\/ledger\/entry-1"/);
});

test("outflow card shows a minus-prefixed amount and Payé à, with no product field", () => {
  const html = renderToStaticMarkup(
    <LedgerEntryCard
      entry={baseEntry({
        type: "OUTFLOW",
        category: "FUEL",
        amount: "25000.00",
        product: null,
        counterpartyName: "Julbert Serme",
      })}
    />,
  );

  assert.match(html, /- 25 000 CFA/);
  assert.match(html, /Carburant/);
  assert.match(html, /Payé à/);
  assert.match(html, /Julbert Serme/);
});

test("shows creator display name and Annulée status for a reversed entry", () => {
  const html = renderToStaticMarkup(
    <LedgerEntryCard entry={baseEntry({ status: "REVERSED" })} />,
  );

  assert.match(html, /Annulée/);
});

test("marks a reversal entry as an annulment without deleting anything from view", () => {
  const html = renderToStaticMarkup(
    <LedgerEntryCard
      entry={baseEntry({
        type: "OUTFLOW",
        category: "OTHER_OUTFLOW",
        reversalOfId: "entry-original",
      })}
    />,
  );

  assert.match(html, /Annulation d’une écriture/);
});
