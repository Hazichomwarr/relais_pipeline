import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import FinancialComparisonIndicator from "./FinancialComparisonIndicator";

test("null change renders the unavailable-comparison message, not a fake percentage", () => {
  const html = renderToStaticMarkup(
    <FinancialComparisonIndicator changePercent={null} tone="revenue" />,
  );

  assert.match(html, /Pas de comparaison disponible/);
});

test("positive revenue change is prefixed with + and colored green", () => {
  const html = renderToStaticMarkup(
    <FinancialComparisonIndicator changePercent="18.00" tone="revenue" />,
  );

  assert.match(html, /\+18\.00 % vs période précédente/);
  assert.match(html, /text-emerald-600/);
});

test("negative revenue change keeps the minus sign and is colored red", () => {
  const html = renderToStaticMarkup(
    <FinancialComparisonIndicator changePercent="-25.00" tone="revenue" />,
  );

  assert.match(html, /-25\.00 % vs période précédente/);
  assert.doesNotMatch(html, /--25/);
  assert.match(html, /text-red-600/);
});

test("expense tone never uses celebratory green, even for a positive change", () => {
  const html = renderToStaticMarkup(
    <FinancialComparisonIndicator changePercent="40.00" tone="expense" />,
  );

  assert.doesNotMatch(html, /text-emerald/);
  assert.doesNotMatch(html, /text-red/);
  assert.match(html, /text-slate-500/);
});
