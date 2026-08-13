import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import CurrentPipelineDistribution from "./CurrentPipelineDistribution";

const FULL_PIPELINE = [
  { status: "NEW" as const, count: 100, percentage: 66.7 },
  { status: "TO_FOLLOW_UP" as const, count: 8, percentage: 5.3 },
  { status: "CONTACTED" as const, count: 18, percentage: 12 },
  { status: "QUALIFIED" as const, count: 12, percentage: 8 },
  { status: "PROPOSAL_SENT" as const, count: 6, percentage: 4 },
  { status: "WON" as const, count: 5, percentage: 3.3 },
  { status: "LOST" as const, count: 1, percentage: 0.7 },
];

test("renders all 7 statuses with their French labels and counts, none dropped", () => {
  const html = renderToStaticMarkup(
    <CurrentPipelineDistribution pipeline={FULL_PIPELINE} />,
  );

  for (const label of [
    "Nouveau",
    "À suivre",
    "Contacté",
    "Qualifié",
    "Proposition envoyée",
    "Gagné",
    "Perdu",
  ]) {
    assert.match(html, new RegExp(label));
  }
  assert.match(html, /100 · 67%/);
});

test("wording describes a current-state distribution, never presents itself as a cumulative stage-to-stage conversion funnel", () => {
  const html = renderToStaticMarkup(
    <CurrentPipelineDistribution pipeline={FULL_PIPELINE} />,
  );

  // The ticket's forbidden heading is "Taux de passage par étape" — the
  // component explicitly disclaims this in its subtitle ("pas un taux de
  // passage..."), which is fine; what must never appear is the forbidden
  // heading itself, or a percentage framed as a step-to-step rate.
  assert.match(html, /Répartition actuelle du pipeline/);
  assert.doesNotMatch(html, /^Taux de passage par étape$/m);
  assert.doesNotMatch(html, /<h2[^>]*>Taux de passage/);
});
