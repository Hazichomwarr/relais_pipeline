import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import FinancialReportSummaryCards from "./FinancialReportSummaryCards";

test("renders inflows, outflows, net, and entry count formatted as XOF", () => {
  const html = renderToStaticMarkup(
    <FinancialReportSummaryCards
      summary={{
        inflows: "850000.00",
        outflows: "320000.00",
        net: "530000.00",
        entryCount: 12,
      }}
      comparison={{
        previousInflows: "720000.00",
        previousOutflows: "333333.00",
        previousNet: "386667.00",
        inflowChangePercent: "18.06",
        outflowChangePercent: "-4.00",
        netChangePercent: "37.07",
      }}
    />,
  );

  assert.match(html, /850 000 CFA/);
  assert.match(html, /320 000 CFA/);
  assert.match(html, /530 000 CFA/);
  assert.match(html, />12</);
  assert.match(html, /\+18\.06 %/);
  assert.match(html, /-4\.00 %/);
});

test("displays the DTO's net verbatim instead of recomputing inflows minus outflows", () => {
  const html = renderToStaticMarkup(
    <FinancialReportSummaryCards
      summary={{
        inflows: "100000.00",
        outflows: "40000.00",
        net: "999999.00",
        entryCount: 2,
      }}
      comparison={{
        previousInflows: "0.00",
        previousOutflows: "0.00",
        previousNet: "0.00",
        inflowChangePercent: null,
        outflowChangePercent: null,
        netChangePercent: null,
      }}
    />,
  );

  assert.match(html, /999 999 CFA/);
  assert.doesNotMatch(html, /60 000 CFA/);
  assert.match(html, /Pas de comparaison disponible/);
});
