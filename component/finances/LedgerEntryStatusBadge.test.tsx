import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import LedgerEntryStatusBadge from "./LedgerEntryStatusBadge";

test("POSTED renders no badge", () => {
  const html = renderToStaticMarkup(<LedgerEntryStatusBadge status="POSTED" />);
  assert.equal(html, "");
});

test("REVERSED renders Annulée, never Supprimée or deletion wording", () => {
  const html = renderToStaticMarkup(
    <LedgerEntryStatusBadge status="REVERSED" />,
  );
  assert.match(html, /Annulée/);
  assert.doesNotMatch(html, /Supprim/i);
});
