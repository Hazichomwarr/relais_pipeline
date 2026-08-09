import assert from "node:assert/strict";
import test from "node:test";

import {
  hydrateDailyReportTemplateData,
  parseDailyReportTemplateData,
} from "./daily-report-template-data.schema";
import type { OperationsCoordinatorDailyReportData } from "./operations-coordinator-daily-report.schema";

test("ASSISTANT dispatches to the assistant schema", () => {
  const result = parseDailyReportTemplateData("ASSISTANT", {
    documentsPrepared: "Contrats classés.",
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal("documentsPrepared" in result.data, true);
    assert.equal("digitalServicesProspects" in result.data, false);
  }
});

test("OPERATIONS_COORDINATOR dispatches to the operations schema", () => {
  const result = parseDailyReportTemplateData("OPERATIONS_COORDINATOR", {
    digitalServicesProspects: 3,
    karmdaSchoolProspects: 1,
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal("digitalServicesProspects" in result.data, true);
    assert.equal("documentsPrepared" in result.data, false);
  }
});

test("an undefined/null payload parses to the template's defaults instead of failing", () => {
  const forAssistant = parseDailyReportTemplateData("ASSISTANT", undefined);
  const forOperations = parseDailyReportTemplateData("OPERATIONS_COORDINATOR", null);

  assert.equal(forAssistant.success, true);
  assert.equal(forOperations.success, true);
});

test("an invalid payload for the resolved template is rejected with a controlled message, not a raw Zod error", () => {
  const result = parseDailyReportTemplateData("OPERATIONS_COORDINATOR", {
    digitalServicesProspects: "abc",
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.message, "Certaines informations du rapport sont invalides.");
  }
});

test("hydrateDailyReportTemplateData normalizes stored JSON into the typed shape for the given templateType", () => {
  const hydrated = hydrateDailyReportTemplateData("OPERATIONS_COORDINATOR", {
    digitalServicesProspects: 2,
    karmdaSchoolProspects: 1,
  }) as OperationsCoordinatorDailyReportData;

  assert.equal(hydrated.digitalServicesProspects, 2);
});

test("hydrateDailyReportTemplateData tolerates a pre-19B report with templateData = null", () => {
  const hydratedAssistant = hydrateDailyReportTemplateData("ASSISTANT", null);
  const hydratedOperations = hydrateDailyReportTemplateData("OPERATIONS_COORDINATOR", null);

  assert.deepEqual(hydratedAssistant, {
    documentsPrepared: "",
    clientsFollowed: "",
    pendingPaymentsOrSignatures: "",
    problemsEncountered: "",
    managementDecisionNeeded: "",
  });
  assert.deepEqual(hydratedOperations, {
    digitalServicesProspects: null,
    karmdaSchoolProspects: null,
    prospectingException: false,
    prospectingExceptionReason: "",
    pendingItems: "",
    problemsEncountered: "",
    managementDecisionNeeded: "",
  });
});
