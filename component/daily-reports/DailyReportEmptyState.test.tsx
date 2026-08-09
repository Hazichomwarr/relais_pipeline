import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import DailyReportEmptyState from "./DailyReportEmptyState";

test("renders the no-history message", () => {
  const html = renderToStaticMarkup(<DailyReportEmptyState />);

  assert.match(html, /Aucun rapport pour le moment/);
});
