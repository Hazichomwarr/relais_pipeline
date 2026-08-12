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
    interest: "COLD",
    status: "NEW",
    nextAction: null,
    followUpDate: null,
    agentName: "Agent Test",
    assignedUser: null,
    ...overrides,
  } as ProspectListItem;
}

test("renders the total prospects KPI across all products, regardless of follow-up state or owner", () => {
  const prospects = [
    prospect({ id: "1", product: "KARMDA", status: "TO_FOLLOW_UP" }),
    prospect({ id: "2", product: "DIGITAL_SERVICES", status: "WON" }),
    prospect({ id: "3", product: "LOKARI", status: "NEW", followUpDate: null }),
    prospect({
      id: "4",
      product: "NIA",
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

  assert.match(html, />4</);
  assert.match(html, /Prospects</);
  assert.match(html, /Tous produits confondus/);
});

test("no longer renders the follow-up KPI copy or CTA", () => {
  const html = renderToStaticMarkup(<KpiCards prospects={[prospect()]} />);

  assert.doesNotMatch(html, /Prospects à rappeler/);
  assert.doesNotMatch(html, /Voir la file de suivi/);
  assert.doesNotMatch(html, /admin\/follow-ups/);
});

test("reconciles with the product-distribution total for the same prospect list", () => {
  const prospects = [
    prospect({ id: "1", product: "KARMDA" }),
    prospect({ id: "2", product: "KARMDA" }),
    prospect({ id: "3", product: "DIGITAL_SERVICES" }),
  ];

  const products = ["KARMDA", "LOKARI", "NIA", "DIGITAL_SERVICES"] as const;
  const sumByProduct = products.reduce(
    (sum, product) =>
      sum + prospects.filter((p) => p.product === product).length,
    0,
  );

  assert.equal(sumByProduct, prospects.length);

  const html = renderToStaticMarkup(<KpiCards prospects={prospects} />);
  assert.match(html, new RegExp(`>${prospects.length}<`));
});

test("empty prospect list renders a total of 0", () => {
  const html = renderToStaticMarkup(<KpiCards prospects={[]} />);

  assert.match(html, />0</);
});
