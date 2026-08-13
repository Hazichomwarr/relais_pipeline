import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import OutcomeReasonBreakdown from "./OutcomeReasonBreakdown";

test("renders all 4 outcome sections when given all 4 entries, each with its own title", () => {
  const html = renderToStaticMarkup(
    <OutcomeReasonBreakdown
      byOutcome={[
        { outcome: "ADVANCED", total: 1, reasons: [{ reason: "DEMO_CONVINCED", count: 1, percentage: 100 }] },
        { outcome: "STALLED", total: 0, reasons: [] },
        { outcome: "WON", total: 0, reasons: [] },
        { outcome: "LOST", total: 0, reasons: [] },
      ]}
    />,
  );

  assert.match(html, /Pourquoi ça avance/);
  assert.match(html, /Pourquoi ça bloque/);
  assert.match(html, /Pourquoi nous gagnons/);
  assert.match(html, /Pourquoi nous perdons/);
});

test("sparse WON/LOST render a graceful empty state, not an invented insight", () => {
  const html = renderToStaticMarkup(
    <OutcomeReasonBreakdown
      byOutcome={[{ outcome: "LOST", total: 0, reasons: [] }]}
    />,
  );
  assert.match(html, /Pas encore assez de données structurées sur les opportunités perdues\./);
});

test("only renders the passed-in entries — the page narrows to one when a Résultat filter is selected", () => {
  const html = renderToStaticMarkup(
    <OutcomeReasonBreakdown
      byOutcome={[{ outcome: "STALLED", total: 2, reasons: [{ reason: "NO_BUDGET", count: 2, percentage: 100 }] }]}
    />,
  );
  assert.match(html, /Pourquoi ça bloque/);
  assert.doesNotMatch(html, /Pourquoi ça avance/);
  assert.doesNotMatch(html, /Pourquoi nous gagnons/);
  assert.doesNotMatch(html, /Pourquoi nous perdons/);
});
