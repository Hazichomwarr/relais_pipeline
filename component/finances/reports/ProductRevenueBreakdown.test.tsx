import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import ProductRevenueBreakdown from "./ProductRevenueBreakdown";

test("empty product revenue shows the no-client-payments message", () => {
  const html = renderToStaticMarkup(
    <ProductRevenueBreakdown productRevenue={[]} />,
  );

  assert.match(html, /Aucun paiement client sur cette période/);
});

test("renders product label, amount, entry count, and percentage using centralized labels", () => {
  const html = renderToStaticMarkup(
    <ProductRevenueBreakdown
      productRevenue={[
        {
          product: "KARMDA",
          amount: "850000.00",
          entryCount: 7,
          percentOfClientRevenue: "63.00",
        },
      ]}
    />,
  );

  assert.match(html, /KARMDA/);
  assert.match(html, /850 000 CFA/);
  assert.match(html, /7 paiements/);
  assert.match(html, /63\.00 % des paiements clients/);
});

test("singular wording for a single payment", () => {
  const html = renderToStaticMarkup(
    <ProductRevenueBreakdown
      productRevenue={[
        {
          product: "NIA",
          amount: "50000.00",
          entryCount: 1,
          percentOfClientRevenue: "100.00",
        },
      ]}
    />,
  );

  assert.match(html, /1 paiement(?!s)/);
});
