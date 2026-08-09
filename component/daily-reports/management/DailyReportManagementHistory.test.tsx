import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import DailyReportManagementHistory from "./DailyReportManagementHistory";
import type { DailyReportSummary } from "@/src/services/daily-report.service-core";

function makeSummary(overrides: Partial<DailyReportSummary> = {}): DailyReportSummary {
  return {
    id: "report-1",
    owner: { id: "user-1", firstName: "Lucie", lastName: "Gouba" },
    reportDate: "2026-08-08",
    templateType: "ASSISTANT",
    status: "SUBMITTED",
    submittedAt: "2026-08-08T16:51:00.000Z",
    ...overrides,
  };
}

test("groups reports by date and renders the owner, template, status, and a Voir link", () => {
  const html = renderToStaticMarkup(
    <DailyReportManagementHistory reports={[makeSummary()]} />,
  );

  assert.match(html, /8 août 2026/);
  assert.match(html, /Lucie Gouba/);
  assert.match(html, /Assistante de Direction/);
  assert.match(html, /Envoyé/);
  assert.match(html, /Envoyé à 16:51/);
  assert.match(html, /href="\/admin\/reports\/report-1"/);
});

test("a DRAFT historical row shows the DRAFT badge, never a NOT_STARTED-style label", () => {
  const html = renderToStaticMarkup(
    <DailyReportManagementHistory
      reports={[makeSummary({ id: "report-2", status: "DRAFT", submittedAt: null })]}
    />,
  );

  assert.match(html, /Brouillon/);
  assert.doesNotMatch(html, /Non commencé/);
});

test("multiple employees on the same date appear under one date heading", () => {
  const html = renderToStaticMarkup(
    <DailyReportManagementHistory
      reports={[
        makeSummary({ id: "report-1", owner: { id: "user-1", firstName: "Lucie", lastName: "Gouba" } }),
        makeSummary({
          id: "report-2",
          owner: { id: "user-2", firstName: "Mamadou", lastName: "Nana" },
          templateType: "OPERATIONS_COORDINATOR",
        }),
      ]}
    />,
  );

  const dateHeadingCount = html.match(/8 août 2026/g)?.length ?? 0;
  assert.equal(dateHeadingCount, 1);
  assert.match(html, /Lucie Gouba/);
  assert.match(html, /Mamadou Nana/);
});
