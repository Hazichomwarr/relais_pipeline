import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import DailyReportTodayCard from "./DailyReportTodayCard";
import type { DailyReportRow } from "@/src/services/daily-report.service-core";

function makeReport(overrides: Partial<DailyReportRow> = {}): DailyReportRow {
  return {
    id: "report-1",
    ownerUserId: "user-1",
    reportDate: new Date("2026-08-09T00:00:00.000Z"),
    templateType: "ASSISTANT",
    status: "DRAFT",
    accomplishedToday: "",
    plannedTomorrow: "",
    templateData: {
      documentsPrepared: "",
      clientsFollowed: "",
      pendingPaymentsOrSignatures: "",
      problemsEncountered: "",
      managementDecisionNeeded: "",
    },
    submittedAt: null,
    createdAt: new Date("2026-08-09T09:00:00.000Z"),
    updatedAt: new Date("2026-08-09T09:00:00.000Z"),
    ...overrides,
  };
}

test("no report yet: shows the 'not started' message and a CTA linking into the inline create form", () => {
  const html = renderToStaticMarkup(<DailyReportTodayCard report={null} />);

  assert.match(html, /Aucun rapport commencé aujourd’hui/);
  assert.match(html, /Commencer mon rapport/);
  assert.match(html, /href="#rapport-du-jour-formulaire"/);
});

test("DRAFT report: shows the Brouillon badge and a link to continue it", () => {
  const html = renderToStaticMarkup(
    <DailyReportTodayCard report={makeReport({ status: "DRAFT" })} />,
  );

  assert.match(html, /Brouillon/);
  assert.match(html, /Continuer mon rapport/);
  assert.match(html, /href="\/reports\/report-1"/);
});

test("SUBMITTED report: shows the submitted time and a link to view it, no edit affordance", () => {
  const html = renderToStaticMarkup(
    <DailyReportTodayCard
      report={makeReport({
        status: "SUBMITTED",
        submittedAt: new Date("2026-08-09T16:47:00.000Z"),
      })}
    />,
  );

  assert.match(html, /Envoyé à 16:47/);
  assert.match(html, /Voir le rapport/);
  assert.doesNotMatch(html, /Continuer/);
});
