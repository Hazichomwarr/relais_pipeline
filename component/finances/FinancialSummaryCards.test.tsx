import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import FinancialSummaryCards from "./FinancialSummaryCards";

test("renders balance, inflows, outflows, and entry count formatted as XOF", () => {
  const html = renderToStaticMarkup(
    <FinancialSummaryCards
      summary={{
        currencyCode: "XOF",
        totalInflows: "1690000.00",
        totalOutflows: "410000.00",
        balance: "1280000.00",
        postedEntryCount: 27,
      }}
    />,
  );

  assert.match(html, /1 280 000 CFA/);
  assert.match(html, /1 690 000 CFA/);
  assert.match(html, /410 000 CFA/);
  assert.match(html, />27</);
});

test("renders zero amounts and zero entry count correctly on an empty ledger", () => {
  const html = renderToStaticMarkup(
    <FinancialSummaryCards
      summary={{
        currencyCode: "XOF",
        totalInflows: "0.00",
        totalOutflows: "0.00",
        balance: "0.00",
        postedEntryCount: 0,
      }}
    />,
  );

  assert.match(html, /0 CFA/);
  assert.match(html, />0</);
});

test("displays the summary DTO's balance verbatim instead of recomputing inflows minus outflows", () => {
  // A balance deliberately inconsistent with inflows - outflows: if the
  // component ever starts doing arithmetic in JSX instead of trusting the
  // Ticket 17A summary DTO, this test catches the regression immediately.
  const html = renderToStaticMarkup(
    <FinancialSummaryCards
      summary={{
        currencyCode: "XOF",
        totalInflows: "100000.00",
        totalOutflows: "40000.00",
        balance: "999999.00",
        postedEntryCount: 2,
      }}
    />,
  );

  assert.match(html, /999 999 CFA/);
  assert.doesNotMatch(html, /60 000 CFA/);
});
