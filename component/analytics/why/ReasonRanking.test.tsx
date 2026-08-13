import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import ReasonRanking from "./ReasonRanking";

test("renders each reason's centralized French label, count, and percentage", () => {
  const html = renderToStaticMarkup(
    <ReasonRanking
      reasons={[
        {
          reason: "PROMOTIONAL_OFFER",
          count: 14,
          percentage: 33,
          byOutcome: { advanced: 10, stalled: 0, won: 4, lost: 0 },
        },
        {
          reason: "DEMO_CONVINCED",
          count: 9,
          percentage: 21,
          byOutcome: { advanced: 9, stalled: 0, won: 0, lost: 0 },
        },
      ]}
    />,
  );

  assert.match(html, /Offre promotionnelle/);
  assert.match(html, /14 · 33%/);
  assert.match(html, /Démonstration convaincante/);
});

test("renders the empty message when there are no structured reasons in scope, never a raw 0", () => {
  const html = renderToStaticMarkup(<ReasonRanking reasons={[]} />);
  assert.match(html, /Aucune raison structurée pour cette période et ces filtres\./);
});

test("accepts a custom title and empty message for outcome-scoped rankings", () => {
  const html = renderToStaticMarkup(
    <ReasonRanking reasons={[]} title="Pourquoi nous perdons" emptyMessage="Pas encore assez de données." />,
  );
  assert.match(html, /Pourquoi nous perdons/);
  assert.match(html, /Pas encore assez de données\./);
});
