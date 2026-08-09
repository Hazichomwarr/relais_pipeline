import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import DailyReporterStateBadge from "./DailyReporterStateBadge";

test("renders Envoyé for SUBMITTED", () => {
  assert.match(
    renderToStaticMarkup(<DailyReporterStateBadge state="SUBMITTED" />),
    /Envoyé/,
  );
});

test("renders Brouillon for DRAFT", () => {
  assert.match(
    renderToStaticMarkup(<DailyReporterStateBadge state="DRAFT" />),
    /Brouillon/,
  );
});

test("renders Non commencé for NOT_STARTED", () => {
  assert.match(
    renderToStaticMarkup(<DailyReporterStateBadge state="NOT_STARTED" />),
    /Non commencé/,
  );
});
