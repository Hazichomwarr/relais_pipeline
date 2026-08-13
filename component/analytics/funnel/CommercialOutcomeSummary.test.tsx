import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import CommercialOutcomeSummary from "./CommercialOutcomeSummary";

test("renders the four outcome counts and the legacy-data disclaimer", () => {
  const html = renderToStaticMarkup(
    <CommercialOutcomeSummary
      outcomes={{ advanced: 18, stalled: 9, won: 3, lost: 2, structuredFollowUps: 32 }}
    />,
  );

  assert.match(html, /A avancé/);
  assert.match(html, />18</);
  assert.match(html, /Bloqué/);
  assert.match(html, />9</);
  assert.match(html, /suivis structurés/);
});

test("wording never claims a prospect 'reached the next funnel stage' — outcome is not a status transition", () => {
  const html = renderToStaticMarkup(
    <CommercialOutcomeSummary
      outcomes={{ advanced: 18, stalled: 9, won: 3, lost: 2, structuredFollowUps: 32 }}
    />,
  );

  assert.doesNotMatch(html, /reached the next/i);
  assert.doesNotMatch(html, /a atteint l’étape suivante/i);
});

test("shows the correct empty-state copy — 'no structured results', never 'nothing advanced'", () => {
  const html = renderToStaticMarkup(
    <CommercialOutcomeSummary
      outcomes={{ advanced: 0, stalled: 0, won: 0, lost: 0, structuredFollowUps: 0 }}
    />,
  );

  assert.match(html, /Aucun résultat commercial structuré pour cette période\./);
  assert.doesNotMatch(html, /Aucune opportunité n’a avancé/);
});
