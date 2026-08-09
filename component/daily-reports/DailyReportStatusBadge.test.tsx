import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import DailyReportStatusBadge from "./DailyReportStatusBadge";

test("renders Brouillon for DRAFT", () => {
  const html = renderToStaticMarkup(<DailyReportStatusBadge status="DRAFT" />);

  assert.match(html, /Brouillon/);
});

test("renders Envoyé for SUBMITTED", () => {
  const html = renderToStaticMarkup(<DailyReportStatusBadge status="SUBMITTED" />);

  assert.match(html, /Envoyé/);
});
