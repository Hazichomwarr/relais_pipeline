import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import LedgerEntryCategoryBadge from "./LedgerEntryCategoryBadge";

test("renders the French label for a client payment category", () => {
  const html = renderToStaticMarkup(
    <LedgerEntryCategoryBadge category="CLIENT_PAYMENT" />,
  );
  assert.match(html, /Paiement client/);
});

test("renders the French label for a fuel outflow category", () => {
  const html = renderToStaticMarkup(
    <LedgerEntryCategoryBadge category="FUEL" />,
  );
  assert.match(html, /Carburant/);
});
