import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import LedgerTypeBadge, {
  formatSignedXofAmount,
  getCounterpartyLabel,
  getLedgerTypeLabel,
} from "./LedgerTypeBadge";

test("INFLOW renders the Entrée label", () => {
  const html = renderToStaticMarkup(<LedgerTypeBadge type="INFLOW" />);
  assert.match(html, /Entrée/);
});

test("OUTFLOW renders the Sortie label", () => {
  const html = renderToStaticMarkup(<LedgerTypeBadge type="OUTFLOW" />);
  assert.match(html, /Sortie/);
});

test("getLedgerTypeLabel maps types to French labels", () => {
  assert.equal(getLedgerTypeLabel("INFLOW"), "Entrée");
  assert.equal(getLedgerTypeLabel("OUTFLOW"), "Sortie");
});

test("formatSignedXofAmount prefixes inflows with a plus sign", () => {
  assert.equal(formatSignedXofAmount("INFLOW", "300000.00"), "+ 300 000 CFA");
});

test("formatSignedXofAmount prefixes outflows with a minus sign", () => {
  assert.equal(formatSignedXofAmount("OUTFLOW", "25000.00"), "- 25 000 CFA");
});

test("getCounterpartyLabel adapts to direction (Reçu de / Payé à)", () => {
  assert.equal(getCounterpartyLabel("INFLOW"), "Reçu de");
  assert.equal(getCounterpartyLabel("OUTFLOW"), "Payé à");
});
