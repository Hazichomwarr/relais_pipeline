import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import WhyAnalyticsEmptyState from "./WhyAnalyticsEmptyState";

test("renders the empty-structured-data message, never implying no prospects exist", () => {
  const html = renderToStaticMarkup(<WhyAnalyticsEmptyState />);
  assert.match(html, /Aucune donnée commerciale structurée pour cette période\./);
  assert.doesNotMatch(html, /Aucun prospect/);
});
