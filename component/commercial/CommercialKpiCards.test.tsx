import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import CommercialKpiCards from "./CommercialKpiCards";

function baseKpis() {
  return {
    totalAssignedProspects: 12,
    followUpsToday: 3,
    overdueProspects: 2,
    qualifiedProspects: 4,
    wonProspects: 1,
    lostProspects: 0,
    readyToDiscuss: 2,
    conversionRate: null as number | null,
  };
}

test("renders a dash instead of an invented 0% when conversion rate is null", () => {
  const html = renderToStaticMarkup(
    <CommercialKpiCards kpis={baseKpis()} />,
  );

  assert.match(html, /—/);
  assert.doesNotMatch(html, />0%</);
});

test("renders the conversion rate percentage when available", () => {
  const html = renderToStaticMarkup(
    <CommercialKpiCards kpis={{ ...baseKpis(), conversionRate: 66.6 }} />,
  );

  assert.match(html, /67%/);
});

test("renders every personal KPI value", () => {
  const html = renderToStaticMarkup(
    <CommercialKpiCards kpis={baseKpis()} />,
  );

  assert.match(html, /Mes prospects/);
  assert.match(html, /Suivis aujourd’hui/);
  assert.match(html, /Suivis en retard/);
  assert.match(html, /Qualifiés/);
  assert.match(html, /Gagnés/);
  assert.match(html, /Taux de conversion/);
});
