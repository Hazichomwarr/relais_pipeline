import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import DailyFinancialMovement from "./DailyFinancialMovement";

test("empty daily movement shows a fallback message", () => {
  const html = renderToStaticMarkup(
    <DailyFinancialMovement dailyMovement={[]} />,
  );

  assert.match(html, /Aucun mouvement quotidien à afficher/);
});

test("renders each day's inflows, outflows, and signed net", () => {
  const html = renderToStaticMarkup(
    <DailyFinancialMovement
      dailyMovement={[
        { date: "2026-08-05", inflows: "300000.00", outflows: "25000.00", net: "275000.00" },
        { date: "2026-08-06", inflows: "0.00", outflows: "10000.00", net: "-10000.00" },
      ]}
    />,
  );

  assert.match(html, /05 août/);
  assert.match(html, /Entrées : 300 000 CFA/);
  assert.match(html, /Sorties : 25 000 CFA/);
  assert.match(html, /\+275 000 CFA/);
  assert.match(html, /06 août/);
  assert.match(html, /-10 000 CFA/);
});
