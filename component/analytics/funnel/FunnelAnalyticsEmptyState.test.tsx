import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import FunnelAnalyticsEmptyState from "./FunnelAnalyticsEmptyState";

test("renders the empty-cohort message", () => {
  const html = renderToStaticMarkup(<FunnelAnalyticsEmptyState />);
  assert.match(html, /Aucun prospect pour cette période et ces filtres\./);
});
