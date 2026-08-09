import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import DailyReportReadOnlyView from "./DailyReportReadOnlyView";
import type { DailyReportRow } from "@/src/services/daily-report.service-core";

function makeAssistantReport(
  overrides: Partial<DailyReportRow> = {},
): DailyReportRow {
  return {
    id: "report-1",
    ownerUserId: "user-1",
    reportDate: new Date("2026-08-09T00:00:00.000Z"),
    templateType: "ASSISTANT",
    status: "SUBMITTED",
    accomplishedToday: "Documents classés.",
    plannedTomorrow: "Relancer les prospects.",
    templateData: {
      documentsPrepared: "Contrats classés.",
      clientsFollowed: "",
      pendingPaymentsOrSignatures: "",
      problemsEncountered: "Imprimante en panne.",
      managementDecisionNeeded: "",
    },
    submittedAt: new Date("2026-08-09T16:47:00.000Z"),
    createdAt: new Date("2026-08-09T09:00:00.000Z"),
    updatedAt: new Date("2026-08-09T09:00:00.000Z"),
    ...overrides,
  };
}

test("renders the shared fields and only the populated Assistant fields, no edit controls", () => {
  const html = renderToStaticMarkup(
    <DailyReportReadOnlyView report={makeAssistantReport()} />,
  );

  assert.match(html, /Documents classés\./);
  assert.match(html, /Relancer les prospects\./);
  assert.match(html, /Contrats classés\./);
  assert.match(html, /Imprimante en panne\./);
  assert.doesNotMatch(html, /Clients \/ prospects suivis/);
  assert.doesNotMatch(html, /<button/);
  assert.doesNotMatch(html, /Envoyer le rapport/);
});

test("renders the Operations Coordinator prospection counts and exception, when present", () => {
  const html = renderToStaticMarkup(
    <DailyReportReadOnlyView
      report={makeAssistantReport({
        templateType: "OPERATIONS_COORDINATOR",
        templateData: {
          digitalServicesProspects: 2,
          karmdaSchoolProspects: 1,
          prospectingException: true,
          prospectingExceptionReason: "Formation KARMDA toute la journée.",
          pendingItems: "",
          problemsEncountered: "",
          managementDecisionNeeded: "",
        },
      })}
    />,
  );

  assert.match(html, /Services Digitaux : 2 \/ 3/);
  assert.match(html, /Écoles KARMDA : 1 \/ 1/);
  assert.match(html, /Formation KARMDA toute la journée\./);
});

test("does not render the exception justification when no exception was declared", () => {
  const html = renderToStaticMarkup(
    <DailyReportReadOnlyView
      report={makeAssistantReport({
        templateType: "OPERATIONS_COORDINATOR",
        templateData: {
          digitalServicesProspects: 3,
          karmdaSchoolProspects: 1,
          prospectingException: false,
          prospectingExceptionReason: "",
          pendingItems: "",
          problemsEncountered: "",
          managementDecisionNeeded: "",
        },
      })}
    />,
  );

  assert.doesNotMatch(html, /Exception/);
});
