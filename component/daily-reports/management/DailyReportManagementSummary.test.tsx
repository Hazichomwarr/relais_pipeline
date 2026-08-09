import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import DailyReportManagementSummary from "./DailyReportManagementSummary";

test("renders all four KPI values", () => {
  const html = renderToStaticMarkup(
    <DailyReportManagementSummary
      summary={{ expected: 4, submitted: 2, draft: 1, notStarted: 1 }}
    />,
  );

  assert.match(html, /Attendus/);
  assert.match(html, />4</);
  assert.match(html, /Envoyés/);
  assert.match(html, />2</);
  assert.match(html, /Brouillons/);
  assert.match(html, />1</);
  assert.match(html, /Non commencés/);
});

test("renders the completion rate when there is at least one expected reporter", () => {
  const html = renderToStaticMarkup(
    <DailyReportManagementSummary
      summary={{ expected: 2, submitted: 1, draft: 0, notStarted: 1 }}
    />,
  );

  assert.match(html, /1 \/ 2 envoyés/);
  assert.match(html, /50/);
});

test("omits the completion rate when no one is expected today", () => {
  const html = renderToStaticMarkup(
    <DailyReportManagementSummary
      summary={{ expected: 0, submitted: 0, draft: 0, notStarted: 0 }}
    />,
  );

  assert.doesNotMatch(html, /envoyés —/);
});
