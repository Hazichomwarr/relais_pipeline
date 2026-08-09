import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import DailyReportHistory from "./DailyReportHistory";
import type { DailyReportRow } from "@/src/services/daily-report.service-core";

function makeReport(overrides: Partial<DailyReportRow> = {}): DailyReportRow {
  return {
    id: "report-1",
    ownerUserId: "user-1",
    reportDate: new Date("2026-08-08T00:00:00.000Z"),
    templateType: "OPERATIONS_COORDINATOR",
    status: "SUBMITTED",
    accomplishedToday: "x",
    plannedTomorrow: "y",
    templateData: {
      digitalServicesProspects: 3,
      karmdaSchoolProspects: 1,
      prospectingException: false,
      prospectingExceptionReason: "",
      pendingItems: "",
      problemsEncountered: "",
      managementDecisionNeeded: "",
    },
    submittedAt: new Date("2026-08-08T16:48:00.000Z"),
    createdAt: new Date("2026-08-08T09:00:00.000Z"),
    updatedAt: new Date("2026-08-08T09:00:00.000Z"),
    ...overrides,
  };
}

test("renders the date, template label, status, submitted time, and a Voir link for a submitted report", () => {
  const html = renderToStaticMarkup(<DailyReportHistory reports={[makeReport()]} />);

  assert.match(html, /8 août 2026/);
  assert.match(html, /Coordinateur des Opérations/);
  assert.match(html, /Envoyé/);
  assert.match(html, /Envoyé à 16:48/);
  assert.match(html, />Voir</);
  assert.match(html, /href="\/reports\/report-1"/);
});

test("a DRAFT row shows a Continuer link instead of Voir, and no submitted time", () => {
  const html = renderToStaticMarkup(
    <DailyReportHistory
      reports={[
        makeReport({
          id: "report-2",
          status: "DRAFT",
          submittedAt: null,
        }),
      ]}
    />,
  );

  assert.match(html, />Continuer</);
  assert.doesNotMatch(html, /Envoyé à/);
});

test("renders one row per report, most recent given first (ordering is the caller's responsibility)", () => {
  const html = renderToStaticMarkup(
    <DailyReportHistory
      reports={[
        makeReport({ id: "report-a", reportDate: new Date("2026-08-09T00:00:00.000Z") }),
        makeReport({ id: "report-b", reportDate: new Date("2026-08-08T00:00:00.000Z") }),
      ]}
    />,
  );

  const indexA = html.indexOf("report-a");
  const indexB = html.indexOf("report-b");

  assert.ok(indexA >= 0 && indexB >= 0 && indexA < indexB);
});
