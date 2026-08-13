import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import WhyAnalyticsSummary from "./WhyAnalyticsSummary";

test("renders structuredFollowUps, advanced, stalled, won, and lost — the event counts, never a prospect count", () => {
  const html = renderToStaticMarkup(
    <WhyAnalyticsSummary
      summary={{ structuredFollowUps: 42, advanced: 23, stalled: 12, won: 5, lost: 2 }}
    />,
  );

  assert.match(html, />42</);
  assert.match(html, /Suivis structurés/);
  assert.match(html, />23</);
  assert.match(html, /Avancés/);
  assert.match(html, />12</);
  assert.match(html, /Bloqués/);
  assert.match(html, />5</);
  assert.match(html, /Gagnés/);
  assert.match(html, />2</);
  assert.match(html, /Perdus/);
  assert.doesNotMatch(html, /prospects?</);
});
