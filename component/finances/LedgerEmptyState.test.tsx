import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import LedgerEmptyState from "./LedgerEmptyState";

test("ADMIN (canCreate) sees create buttons for both directions", () => {
  const html = renderToStaticMarkup(<LedgerEmptyState canCreate />);

  assert.match(html, /Aucun mouvement financier enregistré/);
  assert.match(html, /Nouvelle entrée/);
  assert.match(html, /Nouvelle sortie/);
  assert.match(html, /href="\/finances\/new\?type=INFLOW"/);
  assert.match(html, /href="\/finances\/new\?type=OUTFLOW"/);
});

test("MANAGER (read-only) sees explanatory copy without create buttons", () => {
  const html = renderToStaticMarkup(<LedgerEmptyState canCreate={false} />);

  assert.match(html, /Aucun mouvement financier enregistré/);
  assert.doesNotMatch(html, /Nouvelle entrée/);
  assert.doesNotMatch(html, /Nouvelle sortie/);
  assert.doesNotMatch(html, /href="\/finances\/new/);
});
