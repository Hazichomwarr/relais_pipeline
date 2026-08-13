import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import FunnelSummaryCards from "./FunnelSummaryCards";

test("renders total, interested, won, lost, and a formatted conversion rate", () => {
  const html = renderToStaticMarkup(
    <FunnelSummaryCards
      summary={{
        totalProspects: 150,
        interestedProspects: 33,
        wonProspects: 5,
        lostProspects: 3,
        conversionRate: 3.333,
        closedWinRate: 62.5,
      }}
    />,
  );

  assert.match(html, />150</);
  assert.match(html, /Prospects</);
  assert.match(html, />33</);
  assert.match(html, /Intéressés/);
  assert.match(html, />5</);
  assert.match(html, /Gagnés/);
  assert.match(html, />3</);
  assert.match(html, /Perdus/);
  assert.match(html, /3,3%/);
});

test("renders a dash instead of an invented 0% when conversionRate is null", () => {
  const html = renderToStaticMarkup(
    <FunnelSummaryCards
      summary={{
        totalProspects: 0,
        interestedProspects: 0,
        wonProspects: 0,
        lostProspects: 0,
        conversionRate: null,
        closedWinRate: null,
      }}
    />,
  );

  assert.match(html, /—/);
  assert.doesNotMatch(html, />0%</);
});

test("never renders closedWinRate in the primary strip — too sparse for V1 (LOST usage was near zero as of the 20A/20D audits)", () => {
  const html = renderToStaticMarkup(
    <FunnelSummaryCards
      summary={{
        totalProspects: 10,
        interestedProspects: 2,
        wonProspects: 1,
        lostProspects: 1,
        conversionRate: 10,
        closedWinRate: 50,
      }}
    />,
  );

  assert.doesNotMatch(html, /Taux de gain/);
});
