import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import ExpenseCategoryBreakdown from "./ExpenseCategoryBreakdown";

test("empty expense categories show the no-expenses message", () => {
  const html = renderToStaticMarkup(
    <ExpenseCategoryBreakdown expenseCategories={[]} />,
  );

  assert.match(html, /Aucune sortie enregistrée sur cette période/);
});

test("renders category label, amount, entry count, and percentage using centralized labels", () => {
  const html = renderToStaticMarkup(
    <ExpenseCategoryBreakdown
      expenseCategories={[
        {
          category: "SALARY",
          amount: "300000.00",
          entryCount: 1,
          percentOfOutflows: "47.00",
        },
        {
          category: "TRANSPORT",
          amount: "95000.00",
          entryCount: 3,
          percentOfOutflows: "15.00",
        },
      ]}
    />,
  );

  assert.match(html, /Salaire/);
  assert.match(html, /300 000 CFA/);
  assert.match(html, /47\.00 % des sorties/);
  assert.match(html, /Transport/);
  assert.match(html, /95 000 CFA/);
  assert.match(html, /3 écritures/);
  // Highest amount rendered first.
  assert.ok(html.indexOf("Salaire") < html.indexOf("Transport"));
});
