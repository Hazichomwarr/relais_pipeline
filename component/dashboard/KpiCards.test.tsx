import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { ProspectListItem } from "@/src/services/prospect.service";

import KpiCards from "./KpiCards";

function prospect(
  overrides: Partial<ProspectListItem> = {},
): ProspectListItem {
  return {
    id: "p1",
    product: "KARMDA",
    interest: "NOT_INTERESTED",
    status: "NEW",
    nextAction: null,
    followUpDate: null,
    agentName: "Agent Test",
    assignedUser: null,
    ...overrides,
  } as ProspectListItem;
}

test("renders exactly four KPI cards: Commerciaux, Prospects intéressés, Prêts à discuter, Opportunités gagnées", () => {
  const html = renderToStaticMarkup(<KpiCards prospects={[prospect()]} />);

  assert.match(html, /Commerciaux</);
  assert.match(html, /Prospects intéressés</);
  assert.match(html, /Prêts à discuter</);
  assert.match(html, /Opportunités gagnées</);

  const cardHeadingCount = (html.match(/<h2[^>]*>/g) ?? []).length;
  assert.equal(cardHeadingCount, 4);
});

test("no longer renders a standalone total-Prospects KPI card", () => {
  const html = renderToStaticMarkup(<KpiCards prospects={[prospect()]} />);

  assert.doesNotMatch(html, />Prospects</);
  assert.doesNotMatch(html, /Tous produits confondus/);
});

test("no longer renders the follow-up KPI copy or CTA", () => {
  const html = renderToStaticMarkup(<KpiCards prospects={[prospect()]} />);

  assert.doesNotMatch(html, /Prospects à rappeler/);
  assert.doesNotMatch(html, /Voir la file de suivi/);
  assert.doesNotMatch(html, /admin\/follow-ups/);
});

test("Prêts à discuter counts only the structured READY_TO_DISCUSS interest level, as a percentage of the filtered total", () => {
  const prospects = [
    prospect({ id: "1", interest: "READY_TO_DISCUSS" }),
    prospect({ id: "2", interest: "READY_TO_DISCUSS" }),
    prospect({ id: "3", interest: "READY_TO_DISCUSS" }),
    prospect({ id: "4", interest: "INTERESTED" }),
    prospect({ id: "5", interest: "INTERESTED" }),
    prospect({ id: "6", interest: "MAYBE" }),
    prospect({ id: "7", interest: "MAYBE" }),
    prospect({ id: "8", interest: "NEEDS_INFORMATION" }),
    prospect({ id: "9", interest: "NOT_INTERESTED" }),
    prospect({ id: "10", interest: "NOT_INTERESTED" }),
  ];

  assert.equal(prospects.length, 10);

  const html = renderToStaticMarkup(<KpiCards prospects={prospects} />);

  assert.match(html, />3</);
  assert.match(html, /30% du total/);
});

test("Prêts à discuter shows 0 / 0% for an empty prospect list, without NaN", () => {
  const html = renderToStaticMarkup(<KpiCards prospects={[]} />);

  assert.doesNotMatch(html, /NaN/);
  assert.match(html, /0% du total/);
});

test("Commerciaux, Prospects intéressés and Opportunités gagnées keep their existing definitions", () => {
  const prospects = [
    prospect({
      id: "1",
      interest: "INTERESTED",
      status: "TO_FOLLOW_UP",
      agentName: "Agent A",
    }),
    prospect({
      id: "2",
      interest: "READY_TO_DISCUSS",
      status: "WON",
      agentName: "Agent B",
    }),
    prospect({ id: "3", interest: "NOT_INTERESTED", status: "NEW" }),
    prospect({
      id: "4",
      interest: "MAYBE",
      status: "QUALIFIED",
      assignedUser: {
        id: "u1",
        firstName: "A",
        lastName: "B",
        role: "COMMERCIAL",
        active: true,
      },
    }),
  ];

  const html = renderToStaticMarkup(<KpiCards prospects={prospects} />);

  // isInterestedProspect counts INTERESTED + READY_TO_DISCUSS -> 2 of 4 -> 50%
  assert.match(html, /50% du total/);
  // 4 distinct agent names: "Agent A", "Agent B", the default agentName, and the assignedUser -> Commerciaux
  assert.match(html, />4</);
  // exactly one WON prospect -> Opportunités gagnées
  assert.match(html, />1</);
});

test("empty prospect list renders a total of 0", () => {
  const html = renderToStaticMarkup(<KpiCards prospects={[]} />);

  assert.match(html, />0</);
});
