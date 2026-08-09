import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import DailyReporterCard from "./DailyReporterCard";
import type { DailyReporterStatus } from "@/src/services/daily-report.service-core";

function makeReporter(overrides: Partial<DailyReporterStatus> = {}): DailyReporterStatus {
  return {
    user: { id: "user-1", firstName: "Lucie", lastName: "Gouba" },
    templateType: "ASSISTANT",
    state: "NOT_STARTED",
    reportId: null,
    submittedAt: null,
    operationsSummary: null,
    hasDecisionNeeded: false,
    hasProblemReported: false,
    ...overrides,
  };
}

test("NOT_STARTED reporter shows the badge and employee/template info but no view link", () => {
  const html = renderToStaticMarkup(<DailyReporterCard reporter={makeReporter()} />);

  assert.match(html, /Lucie Gouba/);
  assert.match(html, /Assistante de Direction/);
  assert.match(html, /Non commencé/);
  assert.doesNotMatch(html, /Voir le rapport/);
});

test("DRAFT reporter is visually marked as not yet sent, and links to the report", () => {
  const html = renderToStaticMarkup(
    <DailyReporterCard
      reporter={makeReporter({ state: "DRAFT", reportId: "report-1" })}
    />,
  );

  assert.match(html, /Brouillon — non encore envoyé/);
  assert.match(html, /href="\/admin\/reports\/report-1"/);
});

test("SUBMITTED reporter shows the submitted time and a view link", () => {
  const html = renderToStaticMarkup(
    <DailyReporterCard
      reporter={makeReporter({
        state: "SUBMITTED",
        reportId: "report-1",
        submittedAt: "2026-08-09T16:47:00.000Z",
      })}
    />,
  );

  assert.match(html, /Envoyé à 16:47/);
  assert.match(html, /href="\/admin\/reports\/report-1"/);
});

test("Operations Coordinator reporter with a report renders the prospecting summary", () => {
  const html = renderToStaticMarkup(
    <DailyReporterCard
      reporter={makeReporter({
        templateType: "OPERATIONS_COORDINATOR",
        state: "SUBMITTED",
        reportId: "report-1",
        operationsSummary: {
          digitalServicesProspects: 3,
          karmdaSchoolProspects: 1,
          prospectingException: false,
          prospectingExceptionReason: "",
        },
      })}
    />,
  );

  assert.match(html, /Prospection/);
  assert.match(html, /3 \/ 3/);
});

test("attention indicators only render when flagged", () => {
  const withAttention = renderToStaticMarkup(
    <DailyReporterCard
      reporter={makeReporter({
        state: "SUBMITTED",
        reportId: "report-1",
        hasDecisionNeeded: true,
        hasProblemReported: true,
      })}
    />,
  );
  const without = renderToStaticMarkup(
    <DailyReporterCard reporter={makeReporter({ state: "SUBMITTED", reportId: "report-1" })} />,
  );

  assert.match(withAttention, /Décision signalée/);
  assert.match(withAttention, /Problème signalé/);
  assert.doesNotMatch(without, /Décision signalée/);
  assert.doesNotMatch(without, /Problème signalé/);
});
