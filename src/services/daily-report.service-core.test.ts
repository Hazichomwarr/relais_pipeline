import assert from "node:assert/strict";
import test from "node:test";
import type { DailyReportTemplateType } from "@prisma/client";

import { hydrateDailyReportTemplateData } from "@/src/lib/validations/daily-report-template-data.schema";
import {
  compareDailyReportAttentionItems,
  compareDailyReporterStatuses,
  compareDailyReportsForManagement,
  compareDailyReportsForOwnHistory,
  composeDailyReportManagementDashboard,
  createOwnDailyReportCore,
  filterDailyReporterStatuses,
  getDailyReportForManagementCore,
  getDailyReportManagementDashboardCore,
  getOwnDailyReportByIdCore,
  getOwnDailyReportForDateCore,
  listDailyReportsForManagementCore,
  listOwnDailyReportsCore,
  submitOwnDailyReportCore,
  toDailyReportDetail,
  toDailyReportSummary,
  updateOwnDailyReportCore,
  type DailyReporterStatus,
  type DailyReportExpectedUser,
  type DailyReportManagementRow,
  type DailyReportOwnerRef,
  type DailyReportRow,
  type DailyReportServiceDependencies,
} from "./daily-report.service-core";

function makeReport(
  id: string,
  ownerUserId: string,
  overrides: Partial<DailyReportRow> = {},
): DailyReportRow {
  const templateType = overrides.templateType ?? "ASSISTANT";
  return {
    id,
    ownerUserId,
    reportDate: new Date("2026-08-01T00:00:00.000Z"),
    templateType,
    status: "DRAFT",
    accomplishedToday: "Réalisé du jour.",
    plannedTomorrow: "Prévu demain.",
    templateData: hydrateDailyReportTemplateData(templateType, {}),
    submittedAt: null,
    createdAt: new Date("2026-08-01T09:00:00.000Z"),
    updatedAt: new Date("2026-08-01T09:00:00.000Z"),
    ...overrides,
  };
}

function createReportStore(
  initial: DailyReportRow[] = [],
  templatesByUser: Record<string, DailyReportTemplateType | null> = {},
  ownersById: Record<string, DailyReportOwnerRef> = {},
) {
  const reports = initial.map((report) => ({ ...report }));
  let counter = reports.length;

  function toManagementRow(report: DailyReportRow): DailyReportManagementRow {
    return {
      ...report,
      owner: ownersById[report.ownerUserId] ?? {
        id: report.ownerUserId,
        firstName: "Prénom",
        lastName: "Nom",
      },
    };
  }

  const dependencies: DailyReportServiceDependencies = {
    findOwnerTemplateType: async (ownerUserId) =>
      templatesByUser[ownerUserId] ?? null,

    findOwnByDate: async (ownerUserId, reportDate) =>
      reports.find(
        (report) =>
          report.ownerUserId === ownerUserId &&
          report.reportDate.getTime() === reportDate.getTime(),
      ) ?? null,

    findOwnById: async (ownerUserId, reportId) =>
      reports.find(
        (report) => report.id === reportId && report.ownerUserId === ownerUserId,
      ) ?? null,

    listOwn: async (ownerUserId) =>
      reports.filter((report) => report.ownerUserId === ownerUserId),

    create: async (ownerUserId, templateType, reportDate, fields, templateData) => {
      counter += 1;
      const id = `report-${counter}`;
      reports.push(
        makeReport(id, ownerUserId, {
          reportDate,
          templateType,
          status: "DRAFT",
          accomplishedToday: fields.accomplishedToday,
          plannedTomorrow: fields.plannedTomorrow,
          templateData,
          submittedAt: null,
        }),
      );
      return { id };
    },

    // Mirrors the real Prisma updateMany({ where: { id, ownerUserId, status: "DRAFT" } })
    // — only mutates (and only counts as affected) when all three still match.
    updateOwnDraft: async (ownerUserId, reportId, fields, templateData) => {
      const report = reports.find(
        (candidate) =>
          candidate.id === reportId &&
          candidate.ownerUserId === ownerUserId &&
          candidate.status === "DRAFT",
      );
      if (!report) {
        return 0;
      }
      report.accomplishedToday = fields.accomplishedToday;
      report.plannedTomorrow = fields.plannedTomorrow;
      report.templateData = templateData;
      report.updatedAt = new Date();
      return 1;
    },

    // Same conditional-write strategy as updateOwnDraft, used to prove the
    // DRAFT -> SUBMITTED transition can only succeed once.
    submitOwnDraft: async (ownerUserId, reportId, submittedAt) => {
      const report = reports.find(
        (candidate) =>
          candidate.id === reportId &&
          candidate.ownerUserId === ownerUserId &&
          candidate.status === "DRAFT",
      );
      if (!report) {
        return 0;
      }
      report.status = "SUBMITTED";
      report.submittedAt = submittedAt;
      return 1;
    },

    listForManagement: async (filters) =>
      reports
        .filter((report) => {
          if (filters.ownerUserId && report.ownerUserId !== filters.ownerUserId) {
            return false;
          }
          if (filters.status && report.status !== filters.status) {
            return false;
          }
          if (filters.templateType && report.templateType !== filters.templateType) {
            return false;
          }
          if (filters.dateFrom && report.reportDate.getTime() < filters.dateFrom.getTime()) {
            return false;
          }
          if (filters.dateTo && report.reportDate.getTime() > filters.dateTo.getTime()) {
            return false;
          }
          return true;
        })
        .map(toManagementRow),

    findForManagement: async (reportId) => {
      const report = reports.find((candidate) => candidate.id === reportId);
      return report ? toManagementRow(report) : null;
    },
  };

  return { reports, dependencies };
}

// ---------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------

test("an authenticated user with an assigned template can create their own report", async () => {
  const store = createReportStore([], { "user-1": "ASSISTANT" });
  const result = await createOwnDailyReportCore(
    "user-1",
    {
      reportDate: new Date("2026-08-09T00:00:00.000Z"),
      accomplishedToday: "Documents classés.",
      plannedTomorrow: "Relancer les écoles.",
    },
    store.dependencies,
  );

  assert.equal(result.success, true);
  assert.equal(store.reports.length, 1);
});

test("a user with no assigned template is rejected with a controlled domain result", async () => {
  const store = createReportStore([], { "user-1": null });
  const result = await createOwnDailyReportCore(
    "user-1",
    {
      reportDate: new Date("2026-08-09T00:00:00.000Z"),
      accomplishedToday: "x",
      plannedTomorrow: "y",
    },
    store.dependencies,
  );

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "DAILY_REPORT_NO_TEMPLATE_ASSIGNED");
    assert.equal(result.message, "Aucun modèle de rapport quotidien ne vous est attribué.");
  }
  assert.equal(store.reports.length, 0);
});

test("ownership comes from the ownerUserId argument, never from the input payload", async () => {
  const store = createReportStore([], { "user-1": "ASSISTANT" });
  await createOwnDailyReportCore(
    "user-1",
    {
      reportDate: new Date("2026-08-09T00:00:00.000Z"),
      accomplishedToday: "x",
      plannedTomorrow: "y",
    },
    store.dependencies,
  );

  assert.equal(store.reports[0].ownerUserId, "user-1");
});

for (const templateType of ["ASSISTANT", "OPERATIONS_COORDINATOR"] as const) {
  test(`the created report's templateType comes from the User's ${templateType} assignment, not client input`, async () => {
    const store = createReportStore([], { "user-1": templateType });
    await createOwnDailyReportCore(
      "user-1",
      {
        reportDate: new Date("2026-08-09T00:00:00.000Z"),
        accomplishedToday: "x",
        plannedTomorrow: "y",
      },
      store.dependencies,
    );

    assert.equal(store.reports[0].templateType, templateType);
  });
}

test("a new report starts as DRAFT", async () => {
  const store = createReportStore([], { "user-1": "ASSISTANT" });
  await createOwnDailyReportCore(
    "user-1",
    {
      reportDate: new Date("2026-08-09T00:00:00.000Z"),
      accomplishedToday: "x",
      plannedTomorrow: "y",
    },
    store.dependencies,
  );

  assert.equal(store.reports[0].status, "DRAFT");
  assert.equal(store.reports[0].submittedAt, null);
});

test("a duplicate report for the same owner and business date is rejected", async () => {
  const store = createReportStore([], { "user-1": "ASSISTANT" });
  const reportDate = new Date("2026-08-09T00:00:00.000Z");

  const first = await createOwnDailyReportCore(
    "user-1",
    { reportDate, accomplishedToday: "x", plannedTomorrow: "y" },
    store.dependencies,
  );
  const second = await createOwnDailyReportCore(
    "user-1",
    { reportDate, accomplishedToday: "again", plannedTomorrow: "again" },
    store.dependencies,
  );

  assert.equal(first.success, true);
  assert.equal(second.success, false);
  if (!second.success) {
    assert.equal(second.code, "DAILY_REPORT_ALREADY_EXISTS");
  }
  assert.equal(store.reports.length, 1);
});

test("a different owner may still create a report for the same business date", async () => {
  const store = createReportStore([], {
    "user-1": "ASSISTANT",
    "user-2": "OPERATIONS_COORDINATOR",
  });
  const reportDate = new Date("2026-08-09T00:00:00.000Z");

  const first = await createOwnDailyReportCore(
    "user-1",
    { reportDate, accomplishedToday: "x", plannedTomorrow: "y" },
    store.dependencies,
  );
  const second = await createOwnDailyReportCore(
    "user-2",
    { reportDate, accomplishedToday: "x", plannedTomorrow: "y" },
    store.dependencies,
  );

  assert.equal(first.success, true);
  assert.equal(second.success, true);
  assert.equal(store.reports.length, 2);
});

// ---------------------------------------------------------------------------
// Template data (Ticket 19B)
// ---------------------------------------------------------------------------

test("create validates and stores the Assistant-specific payload, dispatched on the User's assigned template", async () => {
  const store = createReportStore([], { "user-1": "ASSISTANT" });
  const result = await createOwnDailyReportCore(
    "user-1",
    {
      reportDate: new Date("2026-08-09T00:00:00.000Z"),
      accomplishedToday: "x",
      plannedTomorrow: "y",
      templateData: { documentsPrepared: "Contrats classés." },
    },
    store.dependencies,
  );

  assert.equal(result.success, true);
  const stored = store.reports[0].templateData as { documentsPrepared: string };
  assert.equal(stored.documentsPrepared, "Contrats classés.");
});

test("create validates and stores the Operations Coordinator payload", async () => {
  const store = createReportStore([], { "user-1": "OPERATIONS_COORDINATOR" });
  const result = await createOwnDailyReportCore(
    "user-1",
    {
      reportDate: new Date("2026-08-09T00:00:00.000Z"),
      accomplishedToday: "x",
      plannedTomorrow: "y",
      templateData: { digitalServicesProspects: 2, karmdaSchoolProspects: 1 },
    },
    store.dependencies,
  );

  assert.equal(result.success, true);
  const stored = store.reports[0].templateData as {
    digitalServicesProspects: number | null;
  };
  assert.equal(stored.digitalServicesProspects, 2);
});

test("an invalid template payload (e.g. a non-numeric prospecting count) is rejected at creation", async () => {
  const store = createReportStore([], { "user-1": "OPERATIONS_COORDINATOR" });
  const result = await createOwnDailyReportCore(
    "user-1",
    {
      reportDate: new Date("2026-08-09T00:00:00.000Z"),
      accomplishedToday: "x",
      plannedTomorrow: "y",
      templateData: { digitalServicesProspects: "abc" },
    },
    store.dependencies,
  );

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "DAILY_REPORT_TEMPLATE_DATA_INVALID");
  }
  assert.equal(store.reports.length, 0);
});

test("a draft may save an incomplete Operations Coordinator payload (autosave-friendly)", async () => {
  const store = createReportStore([], { "user-1": "OPERATIONS_COORDINATOR" });
  const result = await createOwnDailyReportCore(
    "user-1",
    {
      reportDate: new Date("2026-08-09T00:00:00.000Z"),
      accomplishedToday: "",
      plannedTomorrow: "",
      templateData: {},
    },
    store.dependencies,
  );

  assert.equal(result.success, true);
});

test("update validates template data against the report's stored templateType, not any client-claimed one", async () => {
  const store = createReportStore([
    makeReport("report-1", "user-1", { templateType: "ASSISTANT" }),
  ]);

  const result = await updateOwnDailyReportCore(
    "user-1",
    "report-1",
    {
      accomplishedToday: "x",
      plannedTomorrow: "y",
      // Structurally valid for the Operations template, but this report's
      // stored templateType is ASSISTANT — must dispatch to the assistant
      // schema regardless, ignoring these fields rather than switching.
      templateData: { digitalServicesProspects: 3, karmdaSchoolProspects: 1 },
    } as never,
    store.dependencies,
  );

  assert.equal(result.success, true);
  assert.equal(store.reports[0].templateType, "ASSISTANT");
  const stored = store.reports[0].templateData as { documentsPrepared: string };
  assert.equal(stored.documentsPrepared, "");
});

test("update persists a valid template payload change", async () => {
  const store = createReportStore([
    makeReport("report-1", "user-1", { templateType: "ASSISTANT" }),
  ]);

  const result = await updateOwnDailyReportCore(
    "user-1",
    "report-1",
    {
      accomplishedToday: "x",
      plannedTomorrow: "y",
      templateData: { documentsPrepared: "Mis à jour." },
    },
    store.dependencies,
  );

  assert.equal(result.success, true);
  const stored = store.reports[0].templateData as { documentsPrepared: string };
  assert.equal(stored.documentsPrepared, "Mis à jour.");
});

// ---------------------------------------------------------------------------
// Template snapshot
// ---------------------------------------------------------------------------

test("a later User template reassignment does not alter a report already created under the old template", async () => {
  const templatesByUser: Record<string, DailyReportTemplateType | null> = {
    "user-1": "ASSISTANT",
  };
  const store = createReportStore([], templatesByUser);

  const august1 = await createOwnDailyReportCore(
    "user-1",
    {
      reportDate: new Date("2026-08-01T00:00:00.000Z"),
      accomplishedToday: "x",
      plannedTomorrow: "y",
    },
    store.dependencies,
  );
  assert.equal(august1.success, true);

  // Simulates an ADMIN reassigning the user's template on August 15.
  templatesByUser["user-1"] = "OPERATIONS_COORDINATOR";

  const august16 = await createOwnDailyReportCore(
    "user-1",
    {
      reportDate: new Date("2026-08-16T00:00:00.000Z"),
      accomplishedToday: "x",
      plannedTomorrow: "y",
    },
    store.dependencies,
  );
  assert.equal(august16.success, true);

  const augustFirstReport = await getOwnDailyReportByIdCore(
    "user-1",
    (august1 as { success: true; reportId: string }).reportId,
    store.dependencies,
  );
  const august16Report = await getOwnDailyReportByIdCore(
    "user-1",
    (august16 as { success: true; reportId: string }).reportId,
    store.dependencies,
  );

  assert.equal(augustFirstReport?.templateType, "ASSISTANT");
  assert.equal(august16Report?.templateType, "OPERATIONS_COORDINATOR");
});

// ---------------------------------------------------------------------------
// Ownership
// ---------------------------------------------------------------------------

test("a user can read their own report", async () => {
  const store = createReportStore([makeReport("report-1", "user-1")]);
  const report = await getOwnDailyReportByIdCore(
    "user-1",
    "report-1",
    store.dependencies,
  );

  assert.equal(report?.id, "report-1");
});

test("a user cannot read a foreign report through the self-service path", async () => {
  const store = createReportStore([makeReport("report-1", "user-1")]);
  const report = await getOwnDailyReportByIdCore(
    "user-2",
    "report-1",
    store.dependencies,
  );

  assert.equal(report, null);
});

test("a user cannot update a foreign report, and it is left untouched", async () => {
  const store = createReportStore([
    makeReport("report-1", "user-1", { accomplishedToday: "Original" }),
  ]);
  const result = await updateOwnDailyReportCore(
    "user-2",
    "report-1",
    { accomplishedToday: "Piraté", plannedTomorrow: "Piraté" },
    store.dependencies,
  );

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "DAILY_REPORT_NOT_FOUND");
  }
  assert.equal(store.reports[0].accomplishedToday, "Original");
});

test("a user cannot submit a foreign report", async () => {
  const store = createReportStore([makeReport("report-1", "user-1")]);
  const result = await submitOwnDailyReportCore(
    "user-2",
    "report-1",
    store.dependencies,
  );

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "DAILY_REPORT_NOT_FOUND");
  }
  assert.equal(store.reports[0].status, "DRAFT");
});

test("an ADMIN using the self-service path does not silently rewrite someone else's report — ownership is enforced by the userId argument, not by role", async () => {
  const store = createReportStore([
    makeReport("report-1", "commercial-1", { accomplishedToday: "Original" }),
  ]);
  const result = await updateOwnDailyReportCore(
    "admin-1",
    "report-1",
    { accomplishedToday: "Réécrit par un admin", plannedTomorrow: "x" },
    store.dependencies,
  );

  assert.equal(result.success, false);
  assert.equal(store.reports[0].accomplishedToday, "Original");
});

// ---------------------------------------------------------------------------
// Draft update
// ---------------------------------------------------------------------------

test("the owner can update their DRAFT report", async () => {
  const store = createReportStore([makeReport("report-1", "user-1")]);
  const result = await updateOwnDailyReportCore(
    "user-1",
    "report-1",
    { accomplishedToday: "Mis à jour.", plannedTomorrow: "Mis à jour." },
    store.dependencies,
  );

  assert.equal(result.success, true);
  assert.equal(store.reports[0].accomplishedToday, "Mis à jour.");
});

test("a DRAFT may be updated to blank content (autosave-friendly)", async () => {
  const store = createReportStore([makeReport("report-1", "user-1")]);
  const result = await updateOwnDailyReportCore(
    "user-1",
    "report-1",
    { accomplishedToday: "", plannedTomorrow: "" },
    store.dependencies,
  );

  assert.equal(result.success, true);
  assert.equal(store.reports[0].accomplishedToday, "");
});

test("the owner cannot update a SUBMITTED report", async () => {
  const store = createReportStore([
    makeReport("report-1", "user-1", {
      status: "SUBMITTED",
      submittedAt: new Date("2026-08-01T17:00:00.000Z"),
      accomplishedToday: "Original",
    }),
  ]);
  const result = await updateOwnDailyReportCore(
    "user-1",
    "report-1",
    { accomplishedToday: "Modifié après soumission", plannedTomorrow: "x" },
    store.dependencies,
  );

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "DAILY_REPORT_NOT_EDITABLE");
  }
  assert.equal(store.reports[0].accomplishedToday, "Original");
});

test("the conditional mutation query enforces DRAFT status even if a race slips past the pre-check", async () => {
  const store = createReportStore([makeReport("report-1", "user-1")]);

  // Simulates the report being submitted by a concurrent request between
  // updateOwnDailyReportCore's pre-check and its call to updateOwnDraft.
  const originalUpdateOwnDraft = store.dependencies.updateOwnDraft;
  store.dependencies.updateOwnDraft = async (ownerUserId, reportId, fields, templateData) => {
    store.reports[0].status = "SUBMITTED";
    return originalUpdateOwnDraft(ownerUserId, reportId, fields, templateData);
  };

  const result = await updateOwnDailyReportCore(
    "user-1",
    "report-1",
    { accomplishedToday: "Devrait échouer", plannedTomorrow: "x" },
    store.dependencies,
  );

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "DAILY_REPORT_NOT_EDITABLE");
  }
});

// ---------------------------------------------------------------------------
// Submission
// ---------------------------------------------------------------------------

test("a valid DRAFT submits successfully, becomes SUBMITTED, and records submittedAt", async () => {
  const store = createReportStore([makeReport("report-1", "user-1")]);
  const result = await submitOwnDailyReportCore(
    "user-1",
    "report-1",
    store.dependencies,
  );

  assert.equal(result.success, true);
  assert.equal(store.reports[0].status, "SUBMITTED");
  assert.ok(store.reports[0].submittedAt instanceof Date);
});

test("submission is rejected when accomplishedToday is blank", async () => {
  const store = createReportStore([
    makeReport("report-1", "user-1", { accomplishedToday: "   " }),
  ]);
  const result = await submitOwnDailyReportCore(
    "user-1",
    "report-1",
    store.dependencies,
  );

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "DAILY_REPORT_ACCOMPLISHED_REQUIRED");
  }
  assert.equal(store.reports[0].status, "DRAFT");
});

test("submission is rejected when plannedTomorrow is blank", async () => {
  const store = createReportStore([
    makeReport("report-1", "user-1", { plannedTomorrow: "" }),
  ]);
  const result = await submitOwnDailyReportCore(
    "user-1",
    "report-1",
    store.dependencies,
  );

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "DAILY_REPORT_PLANNED_REQUIRED");
  }
  assert.equal(store.reports[0].status, "DRAFT");
});

test("a second submission attempt does not rewrite submittedAt", async () => {
  const store = createReportStore([makeReport("report-1", "user-1")]);

  const first = await submitOwnDailyReportCore("user-1", "report-1", store.dependencies);
  assert.equal(first.success, true);
  const submittedAtAfterFirst = store.reports[0].submittedAt?.getTime();

  const second = await submitOwnDailyReportCore("user-1", "report-1", store.dependencies);
  assert.equal(second.success, false);

  assert.equal(store.reports[0].submittedAt?.getTime(), submittedAtAfterFirst);
});

test("concurrent submission attempts: the atomic guard only lets one of two racing submissions through", async () => {
  const store = createReportStore([makeReport("report-1", "user-1")]);

  const firstCount = await store.dependencies.submitOwnDraft(
    "user-1",
    "report-1",
    new Date("2026-08-01T17:00:00.000Z"),
  );
  const secondCount = await store.dependencies.submitOwnDraft(
    "user-1",
    "report-1",
    new Date("2026-08-01T17:00:05.000Z"),
  );

  assert.equal(firstCount, 1);
  assert.equal(secondCount, 0);
  assert.equal(
    store.reports[0].submittedAt?.toISOString(),
    "2026-08-01T17:00:00.000Z",
  );
});

test("Operations Coordinator submission succeeds when both prospecting targets are met", async () => {
  const store = createReportStore([
    makeReport("report-1", "user-1", {
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
    }),
  ]);

  const result = await submitOwnDailyReportCore("user-1", "report-1", store.dependencies);

  assert.equal(result.success, true);
});

test("Operations Coordinator submission succeeds when a target is missed but a valid exception is given", async () => {
  const store = createReportStore([
    makeReport("report-1", "user-1", {
      templateType: "OPERATIONS_COORDINATOR",
      templateData: {
        digitalServicesProspects: 0,
        karmdaSchoolProspects: 0,
        prospectingException: true,
        prospectingExceptionReason:
          "Formation KARMDA à l’École Horizon de 08h30 à 16h00.",
        pendingItems: "",
        problemsEncountered: "",
        managementDecisionNeeded: "",
      },
    }),
  ]);

  const result = await submitOwnDailyReportCore("user-1", "report-1", store.dependencies);

  assert.equal(result.success, true);
});

test("Operations Coordinator submission is rejected when a target is missed and there is no exception", async () => {
  const store = createReportStore([
    makeReport("report-1", "user-1", {
      templateType: "OPERATIONS_COORDINATOR",
      templateData: {
        digitalServicesProspects: 2,
        karmdaSchoolProspects: 1,
        prospectingException: false,
        prospectingExceptionReason: "",
        pendingItems: "",
        problemsEncountered: "",
        managementDecisionNeeded: "",
      },
    }),
  ]);

  const result = await submitOwnDailyReportCore("user-1", "report-1", store.dependencies);

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "DAILY_REPORT_PROSPECTING_REQUIREMENTS_NOT_MET");
  }
  assert.equal(store.reports[0].status, "DRAFT");
});

test("Operations Coordinator submission is rejected when the exception is checked but the reason is blank", async () => {
  const store = createReportStore([
    makeReport("report-1", "user-1", {
      templateType: "OPERATIONS_COORDINATOR",
      templateData: {
        digitalServicesProspects: 0,
        karmdaSchoolProspects: 0,
        prospectingException: true,
        prospectingExceptionReason: "",
        pendingItems: "",
        problemsEncountered: "",
        managementDecisionNeeded: "",
      },
    }),
  ]);

  const result = await submitOwnDailyReportCore("user-1", "report-1", store.dependencies);

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "DAILY_REPORT_PROSPECTING_REQUIREMENTS_NOT_MET");
  }
});

test("Assistant submission does not apply the prospecting rule at all", async () => {
  const store = createReportStore([
    makeReport("report-1", "user-1", { templateType: "ASSISTANT" }),
  ]);

  const result = await submitOwnDailyReportCore("user-1", "report-1", store.dependencies);

  assert.equal(result.success, true);
});

test("templateData is preserved through submission and remains readable afterward", async () => {
  const store = createReportStore([
    makeReport("report-1", "user-1", {
      templateType: "ASSISTANT",
      templateData: {
        documentsPrepared: "Contrats classés.",
        clientsFollowed: "",
        pendingPaymentsOrSignatures: "",
        problemsEncountered: "",
        managementDecisionNeeded: "",
      },
    }),
  ]);

  await submitOwnDailyReportCore("user-1", "report-1", store.dependencies);
  const afterSubmit = await getOwnDailyReportByIdCore("user-1", "report-1", store.dependencies);
  const templateData = afterSubmit?.templateData as { documentsPrepared: string };

  assert.equal(templateData.documentsPrepared, "Contrats classés.");
});

// ---------------------------------------------------------------------------
// Immutability
// ---------------------------------------------------------------------------

test("a SUBMITTED report cannot be silently mutated via updateOwnDailyReportCore", async () => {
  const store = createReportStore([
    makeReport("report-1", "user-1", {
      status: "SUBMITTED",
      submittedAt: new Date("2026-08-01T17:00:00.000Z"),
    }),
  ]);

  await updateOwnDailyReportCore(
    "user-1",
    "report-1",
    { accomplishedToday: "Tentative de réécriture", plannedTomorrow: "x" },
    store.dependencies,
  );

  assert.notEqual(store.reports[0].accomplishedToday, "Tentative de réécriture");
});

test("template data cannot be rewritten after submit", async () => {
  const store = createReportStore([
    makeReport("report-1", "user-1", {
      templateType: "ASSISTANT",
      status: "SUBMITTED",
      submittedAt: new Date("2026-08-01T17:00:00.000Z"),
      templateData: {
        documentsPrepared: "Original.",
        clientsFollowed: "",
        pendingPaymentsOrSignatures: "",
        problemsEncountered: "",
        managementDecisionNeeded: "",
      },
    }),
  ]);

  await updateOwnDailyReportCore(
    "user-1",
    "report-1",
    {
      accomplishedToday: "x",
      plannedTomorrow: "y",
      templateData: { documentsPrepared: "Tentative de réécriture." },
    },
    store.dependencies,
  );

  const stored = store.reports[0].templateData as { documentsPrepared: string };
  assert.equal(stored.documentsPrepared, "Original.");
});

// ---------------------------------------------------------------------------
// Ordering
// ---------------------------------------------------------------------------

test("own history sorts reportDate DESC, then id DESC as a deterministic tiebreaker", async () => {
  const store = createReportStore([
    makeReport("report-a", "user-1", { reportDate: new Date("2026-08-01T00:00:00.000Z") }),
    makeReport("report-c", "user-1", { reportDate: new Date("2026-08-03T00:00:00.000Z") }),
    makeReport("report-b", "user-1", { reportDate: new Date("2026-08-02T00:00:00.000Z") }),
  ]);

  const reports = await listOwnDailyReportsCore("user-1", store.dependencies);

  assert.deepEqual(
    reports.map((report) => report.id),
    ["report-c", "report-b", "report-a"],
  );
});

test("compareDailyReportsForOwnHistory falls back to a deterministic descending id order on a same-instant tie", () => {
  const sameDate = new Date("2026-08-01T00:00:00.000Z");
  const left = makeReport("report-a", "user-1", { reportDate: sameDate });
  const right = makeReport("report-b", "user-1", { reportDate: sameDate });

  assert.ok(compareDailyReportsForOwnHistory(left, right) > 0);
  assert.ok(compareDailyReportsForOwnHistory(right, left) < 0);
  assert.equal(compareDailyReportsForOwnHistory(left, left), 0);
});

test("management history sorts reportDate DESC, then submittedAt DESC, then id DESC", () => {
  const owner: DailyReportOwnerRef = { id: "user-1", firstName: "Awa", lastName: "Traoré" };
  const sameDate = new Date("2026-08-01T00:00:00.000Z");

  const early: DailyReportManagementRow = {
    ...makeReport("report-early", "user-1", {
      reportDate: sameDate,
      status: "SUBMITTED",
      submittedAt: new Date("2026-08-01T09:00:00.000Z"),
    }),
    owner,
  };
  const late: DailyReportManagementRow = {
    ...makeReport("report-late", "user-1", {
      reportDate: sameDate,
      status: "SUBMITTED",
      submittedAt: new Date("2026-08-01T17:00:00.000Z"),
    }),
    owner,
  };
  const otherDay: DailyReportManagementRow = {
    ...makeReport("report-other-day", "user-1", {
      reportDate: new Date("2026-08-02T00:00:00.000Z"),
      status: "SUBMITTED",
      submittedAt: new Date("2026-08-02T09:00:00.000Z"),
    }),
    owner,
  };

  const sorted = [early, otherDay, late].sort(compareDailyReportsForManagement);

  assert.deepEqual(
    sorted.map((report) => report.id),
    ["report-other-day", "report-late", "report-early"],
  );
});

// ---------------------------------------------------------------------------
// Management read
// ---------------------------------------------------------------------------

test("management listing returns reports across every owner", async () => {
  const store = createReportStore([
    makeReport("report-1", "user-1"),
    makeReport("report-2", "user-2", { reportDate: new Date("2026-08-02T00:00:00.000Z") }),
  ]);

  const reports = await listDailyReportsForManagementCore({}, store.dependencies);

  assert.equal(reports.length, 2);
});

test("management read returns a report owned by a different user, without granting edit access", async () => {
  const store = createReportStore([
    makeReport("report-1", "user-1", { accomplishedToday: "Contenu de l’employé" }),
  ]);

  const detail = await getDailyReportForManagementCore("report-1", store.dependencies);

  assert.equal(detail?.accomplishedToday, "Contenu de l’employé");
  // getDailyReportForManagementCore has no mutation dependency to call at
  // all — there is structurally no edit path through this function.
});

test("toDailyReportSummary formats reportDate and submittedAt as business-local strings", () => {
  const owner: DailyReportOwnerRef = { id: "user-1", firstName: "Awa", lastName: "Traoré" };
  const row: DailyReportManagementRow = {
    ...makeReport("report-1", "user-1", {
      reportDate: new Date("2026-08-09T00:00:00.000Z"),
      status: "SUBMITTED",
      submittedAt: new Date("2026-08-09T17:05:00.000Z"),
    }),
    owner,
  };

  const summary = toDailyReportSummary(row);

  assert.equal(summary.reportDate, "2026-08-09");
  assert.equal(summary.submittedAt, "2026-08-09T17:05:00.000Z");
  assert.equal(summary.owner, owner);
});

test("toDailyReportDetail includes the summary fields plus shared content", () => {
  const owner: DailyReportOwnerRef = { id: "user-1", firstName: "Awa", lastName: "Traoré" };
  const row: DailyReportManagementRow = {
    ...makeReport("report-1", "user-1"),
    owner,
  };

  const detail = toDailyReportDetail(row);

  assert.equal(detail.accomplishedToday, row.accomplishedToday);
  assert.equal(detail.plannedTomorrow, row.plannedTomorrow);
  assert.equal(detail.owner, owner);
});

test("getOwnDailyReportForDateCore resolves the report for a given business date, or null", async () => {
  const store = createReportStore([
    makeReport("report-1", "user-1", { reportDate: new Date("2026-08-09T00:00:00.000Z") }),
  ]);

  const found = await getOwnDailyReportForDateCore(
    "user-1",
    new Date("2026-08-09T00:00:00.000Z"),
    store.dependencies,
  );
  const notFound = await getOwnDailyReportForDateCore(
    "user-1",
    new Date("2026-08-10T00:00:00.000Z"),
    store.dependencies,
  );

  assert.equal(found?.id, "report-1");
  assert.equal(notFound, null);
});

// ---------------------------------------------------------------------------
// Management dashboard (Ticket 19C)
// ---------------------------------------------------------------------------

function makeExpectedUser(
  id: string,
  overrides: Partial<DailyReportExpectedUser> = {},
): DailyReportExpectedUser {
  return {
    id,
    firstName: "Prénom",
    lastName: "Nom",
    dailyReportTemplateType: "ASSISTANT",
    ...overrides,
  };
}

function makeManagementRow(
  id: string,
  ownerUserId: string,
  overrides: Partial<DailyReportManagementRow> = {},
): DailyReportManagementRow {
  const templateType = overrides.templateType ?? "ASSISTANT";
  return {
    id,
    ownerUserId,
    reportDate: new Date("2026-08-09T00:00:00.000Z"),
    templateType,
    status: "SUBMITTED",
    accomplishedToday: "x",
    plannedTomorrow: "y",
    templateData: hydrateDailyReportTemplateData(templateType, {}),
    submittedAt: new Date("2026-08-09T16:47:00.000Z"),
    createdAt: new Date("2026-08-09T09:00:00.000Z"),
    updatedAt: new Date("2026-08-09T09:00:00.000Z"),
    owner: { id: ownerUserId, firstName: "Prénom", lastName: "Nom" },
    ...overrides,
  };
}

test("only active users with an assigned template are expected reporters — never hardcoded, never role-inferred", async () => {
  const rawUsers = [
    { id: "user-1", firstName: "Lucie", lastName: "Gouba", active: true, dailyReportTemplateType: "ASSISTANT" as const },
    { id: "user-2", firstName: "Ancien", lastName: "Employé", active: false, dailyReportTemplateType: "ASSISTANT" as const },
    { id: "user-3", firstName: "Sans", lastName: "Modèle", active: true, dailyReportTemplateType: null },
  ];

  const dashboard = await getDailyReportManagementDashboardCore(
    new Date("2026-08-09T00:00:00.000Z"),
    {
      listExpectedReporters: async () =>
        rawUsers
          .filter((user) => user.active && user.dailyReportTemplateType !== null)
          .map((user) => ({
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            dailyReportTemplateType: user.dailyReportTemplateType!,
          })),
      findReportsForDate: async () => [],
    },
  );

  assert.deepEqual(dashboard.reporters.map((reporter) => reporter.user.id), ["user-1"]);
});

test("getDailyReportManagementDashboardCore uses exactly one bounded query per dependency, never one per employee", async () => {
  let expectedCalls = 0;
  let reportsCalls = 0;

  await getDailyReportManagementDashboardCore(new Date("2026-08-09T00:00:00.000Z"), {
    listExpectedReporters: async () => {
      expectedCalls += 1;
      return [makeExpectedUser("user-1"), makeExpectedUser("user-2"), makeExpectedUser("user-3")];
    },
    findReportsForDate: async () => {
      reportsCalls += 1;
      return [];
    },
  });

  assert.equal(expectedCalls, 1);
  assert.equal(reportsCalls, 1);
});

test("an expected user with a SUBMITTED report today derives state SUBMITTED", () => {
  const dashboard = composeDailyReportManagementDashboard(
    new Date("2026-08-09T00:00:00.000Z"),
    [makeExpectedUser("user-1")],
    [makeManagementRow("report-1", "user-1", { status: "SUBMITTED" })],
  );

  assert.equal(dashboard.reporters[0].state, "SUBMITTED");
  assert.equal(dashboard.reporters[0].reportId, "report-1");
});

test("an expected user with a DRAFT report today derives state DRAFT", () => {
  const dashboard = composeDailyReportManagementDashboard(
    new Date("2026-08-09T00:00:00.000Z"),
    [makeExpectedUser("user-1")],
    [makeManagementRow("report-1", "user-1", { status: "DRAFT", submittedAt: null })],
  );

  assert.equal(dashboard.reporters[0].state, "DRAFT");
});

test("an expected user with no report row today derives state NOT_STARTED — no database row is required or created", () => {
  const dashboard = composeDailyReportManagementDashboard(
    new Date("2026-08-09T00:00:00.000Z"),
    [makeExpectedUser("user-1")],
    [],
  );

  assert.equal(dashboard.reporters[0].state, "NOT_STARTED");
  assert.equal(dashboard.reporters[0].reportId, null);
  assert.equal(dashboard.reporters[0].submittedAt, null);
});

test("summary counts reconcile exactly with the reporter cards: 4 expected, 2 submitted, 1 draft, 1 not started", () => {
  const dashboard = composeDailyReportManagementDashboard(
    new Date("2026-08-09T00:00:00.000Z"),
    [
      makeExpectedUser("user-1"),
      makeExpectedUser("user-2"),
      makeExpectedUser("user-3"),
      makeExpectedUser("user-4"),
    ],
    [
      makeManagementRow("report-1", "user-1", { status: "SUBMITTED" }),
      makeManagementRow("report-2", "user-2", { status: "SUBMITTED" }),
      makeManagementRow("report-3", "user-3", { status: "DRAFT", submittedAt: null }),
      // user-4 has no report row: NOT_STARTED.
    ],
  );

  assert.deepEqual(dashboard.summary, {
    expected: 4,
    submitted: 2,
    draft: 1,
    notStarted: 1,
  });
});

test("businessDate is formatted via the centralized business-date helper", () => {
  const dashboard = composeDailyReportManagementDashboard(
    new Date("2026-08-09T12:00:00.000Z"),
    [],
    [],
  );

  assert.equal(dashboard.businessDate, "2026-08-09");
});

test("reporter ordering: NOT_STARTED, then DRAFT, then SUBMITTED, each group ordered by lastName then firstName then id", () => {
  const dashboard = composeDailyReportManagementDashboard(
    new Date("2026-08-09T00:00:00.000Z"),
    [
      makeExpectedUser("user-1", { firstName: "Mamadou", lastName: "Nana" }),
      makeExpectedUser("user-2", { firstName: "Lucie", lastName: "Gouba" }),
      makeExpectedUser("user-3", { firstName: "Awa", lastName: "Bazié" }),
      makeExpectedUser("user-4", { firstName: "Zoé", lastName: "Kaboré" }),
    ],
    [
      // user-1 (Nana) SUBMITTED, user-2 (Gouba) DRAFT, user-3/user-4 NOT_STARTED.
      makeManagementRow("report-1", "user-1", { status: "SUBMITTED" }),
      makeManagementRow("report-2", "user-2", { status: "DRAFT", submittedAt: null }),
    ],
  );

  assert.deepEqual(
    dashboard.reporters.map((reporter) => reporter.user.id),
    ["user-3", "user-4", "user-2", "user-1"],
  );
});

test("compareDailyReporterStatuses falls back to a deterministic ascending id order on a full tie", () => {
  const left: DailyReporterStatus = {
    user: { id: "user-a", firstName: "Awa", lastName: "Bazié" },
    templateType: "ASSISTANT",
    state: "NOT_STARTED",
    reportId: null,
    submittedAt: null,
    operationsSummary: null,
    hasDecisionNeeded: false,
    hasProblemReported: false,
  };
  const right = { ...left, user: { ...left.user, id: "user-b" } };

  assert.ok(compareDailyReporterStatuses(left, right) < 0);
  assert.ok(compareDailyReporterStatuses(right, left) > 0);
  assert.equal(compareDailyReporterStatuses(left, left), 0);
});

test("decisionsRequired includes a non-empty SUBMITTED managementDecisionNeeded", () => {
  const dashboard = composeDailyReportManagementDashboard(
    new Date("2026-08-09T00:00:00.000Z"),
    [makeExpectedUser("user-1")],
    [
      makeManagementRow("report-1", "user-1", {
        status: "SUBMITTED",
        templateData: hydrateDailyReportTemplateData("ASSISTANT", {
          managementDecisionNeeded: "Contrat école Wend-Panga à valider.",
        }),
      }),
    ],
  );

  assert.equal(dashboard.decisionsRequired.length, 1);
  assert.equal(
    dashboard.decisionsRequired[0].content,
    "Contrat école Wend-Panga à valider.",
  );
});

test("a blank managementDecisionNeeded is excluded from decisionsRequired", () => {
  const dashboard = composeDailyReportManagementDashboard(
    new Date("2026-08-09T00:00:00.000Z"),
    [makeExpectedUser("user-1")],
    [makeManagementRow("report-1", "user-1", { status: "SUBMITTED" })],
  );

  assert.deepEqual(dashboard.decisionsRequired, []);
});

test("a DRAFT report's managementDecisionNeeded is excluded from decisionsRequired even if non-empty", () => {
  const dashboard = composeDailyReportManagementDashboard(
    new Date("2026-08-09T00:00:00.000Z"),
    [makeExpectedUser("user-1")],
    [
      makeManagementRow("report-1", "user-1", {
        status: "DRAFT",
        submittedAt: null,
        templateData: hydrateDailyReportTemplateData("ASSISTANT", {
          managementDecisionNeeded: "Ne doit pas apparaître avant envoi.",
        }),
      }),
    ],
  );

  assert.deepEqual(dashboard.decisionsRequired, []);
});

test("problemsReported includes a non-empty SUBMITTED problemsEncountered, separately from decisions", () => {
  const dashboard = composeDailyReportManagementDashboard(
    new Date("2026-08-09T00:00:00.000Z"),
    [makeExpectedUser("user-1")],
    [
      makeManagementRow("report-1", "user-1", {
        status: "SUBMITTED",
        templateData: hydrateDailyReportTemplateData("ASSISTANT", {
          problemsEncountered: "Imprimante en panne.",
          managementDecisionNeeded: "",
        }),
      }),
    ],
  );

  assert.equal(dashboard.problemsReported.length, 1);
  assert.equal(dashboard.problemsReported[0].content, "Imprimante en panne.");
  assert.deepEqual(dashboard.decisionsRequired, []);
});

test("a blank problemsEncountered is excluded from problemsReported", () => {
  const dashboard = composeDailyReportManagementDashboard(
    new Date("2026-08-09T00:00:00.000Z"),
    [makeExpectedUser("user-1")],
    [makeManagementRow("report-1", "user-1", { status: "SUBMITTED" })],
  );

  assert.deepEqual(dashboard.problemsReported, []);
});

test("a DRAFT report's problemsEncountered is excluded from problemsReported even if non-empty", () => {
  const dashboard = composeDailyReportManagementDashboard(
    new Date("2026-08-09T00:00:00.000Z"),
    [makeExpectedUser("user-1")],
    [
      makeManagementRow("report-1", "user-1", {
        status: "DRAFT",
        submittedAt: null,
        templateData: hydrateDailyReportTemplateData("ASSISTANT", {
          problemsEncountered: "Ne doit pas apparaître avant envoi.",
        }),
      }),
    ],
  );

  assert.deepEqual(dashboard.problemsReported, []);
});

test("attention queues support both templates — Operations Coordinator decisions/problems included the same way", () => {
  const dashboard = composeDailyReportManagementDashboard(
    new Date("2026-08-09T00:00:00.000Z"),
    [makeExpectedUser("user-1", { dailyReportTemplateType: "OPERATIONS_COORDINATOR" })],
    [
      makeManagementRow("report-1", "user-1", {
        templateType: "OPERATIONS_COORDINATOR",
        status: "SUBMITTED",
        templateData: hydrateDailyReportTemplateData("OPERATIONS_COORDINATOR", {
          managementDecisionNeeded: "Le client demande une deuxième journée de formation.",
          problemsEncountered: "École Horizon : configuration réseau incomplète.",
        }),
      }),
    ],
  );

  assert.equal(dashboard.decisionsRequired.length, 1);
  assert.equal(dashboard.problemsReported.length, 1);
});

test("compareDailyReportAttentionItems orders submittedAt DESC, then a descending reportId tiebreaker", () => {
  const sameInstant = "2026-08-09T16:47:00.000Z";
  const owner: DailyReportOwnerRef = { id: "user-1", firstName: "Awa", lastName: "Bazié" };

  const earlier = {
    reportId: "report-a",
    owner,
    templateType: "ASSISTANT" as const,
    content: "x",
    submittedAt: "2026-08-09T09:00:00.000Z",
  };
  const laterA = {
    reportId: "report-b",
    owner,
    templateType: "ASSISTANT" as const,
    content: "y",
    submittedAt: sameInstant,
  };
  const laterB = { ...laterA, reportId: "report-c" };

  const sorted = [earlier, laterB, laterA].sort(compareDailyReportAttentionItems);

  assert.deepEqual(
    sorted.map((item) => item.reportId),
    ["report-c", "report-b", "report-a"],
  );
});

test("operationsSummary is populated for an Operations Coordinator reporter with a report (draft or submitted), null otherwise", () => {
  const dashboard = composeDailyReportManagementDashboard(
    new Date("2026-08-09T00:00:00.000Z"),
    [
      makeExpectedUser("user-1", { dailyReportTemplateType: "OPERATIONS_COORDINATOR" }),
      makeExpectedUser("user-2", { dailyReportTemplateType: "OPERATIONS_COORDINATOR" }),
      makeExpectedUser("user-3", { dailyReportTemplateType: "ASSISTANT" }),
    ],
    [
      makeManagementRow("report-1", "user-1", {
        templateType: "OPERATIONS_COORDINATOR",
        status: "SUBMITTED",
        templateData: hydrateDailyReportTemplateData("OPERATIONS_COORDINATOR", {
          digitalServicesProspects: 3,
          karmdaSchoolProspects: 1,
        }),
      }),
      makeManagementRow("report-2", "user-3", {
        templateType: "ASSISTANT",
        status: "SUBMITTED",
      }),
    ],
  );

  const withReport = dashboard.reporters.find((reporter) => reporter.user.id === "user-1");
  const withoutReport = dashboard.reporters.find((reporter) => reporter.user.id === "user-2");
  const assistantReporter = dashboard.reporters.find((reporter) => reporter.user.id === "user-3");

  assert.deepEqual(withReport?.operationsSummary, {
    digitalServicesProspects: 3,
    karmdaSchoolProspects: 1,
    prospectingException: false,
    prospectingExceptionReason: "",
  });
  assert.equal(withoutReport?.operationsSummary, null);
  assert.equal(assistantReporter?.operationsSummary, null);
});

test("hasDecisionNeeded and hasProblemReported are true only for a SUBMITTED report with non-blank content", () => {
  const dashboard = composeDailyReportManagementDashboard(
    new Date("2026-08-09T00:00:00.000Z"),
    [makeExpectedUser("user-1"), makeExpectedUser("user-2")],
    [
      makeManagementRow("report-1", "user-1", {
        status: "SUBMITTED",
        templateData: hydrateDailyReportTemplateData("ASSISTANT", {
          managementDecisionNeeded: "Décision requise.",
          problemsEncountered: "Problème signalé.",
        }),
      }),
      makeManagementRow("report-2", "user-2", {
        status: "DRAFT",
        submittedAt: null,
        templateData: hydrateDailyReportTemplateData("ASSISTANT", {
          managementDecisionNeeded: "Ne compte pas tant que brouillon.",
          problemsEncountered: "Ne compte pas tant que brouillon.",
        }),
      }),
    ],
  );

  const submittedReporter = dashboard.reporters.find((reporter) => reporter.user.id === "user-1");
  const draftReporter = dashboard.reporters.find((reporter) => reporter.user.id === "user-2");

  assert.equal(submittedReporter?.hasDecisionNeeded, true);
  assert.equal(submittedReporter?.hasProblemReported, true);
  assert.equal(draftReporter?.hasDecisionNeeded, false);
  assert.equal(draftReporter?.hasProblemReported, false);
});

test("filterDailyReporterStatuses narrows by employeeId, templateType, and state independently", () => {
  const reporters: DailyReporterStatus[] = [
    {
      user: { id: "user-1", firstName: "Lucie", lastName: "Gouba" },
      templateType: "ASSISTANT",
      state: "SUBMITTED",
      reportId: "report-1",
      submittedAt: "2026-08-09T16:47:00.000Z",
      operationsSummary: null,
      hasDecisionNeeded: false,
      hasProblemReported: false,
    },
    {
      user: { id: "user-2", firstName: "Mamadou", lastName: "Nana" },
      templateType: "OPERATIONS_COORDINATOR",
      state: "NOT_STARTED",
      reportId: null,
      submittedAt: null,
      operationsSummary: null,
      hasDecisionNeeded: false,
      hasProblemReported: false,
    },
  ];

  assert.deepEqual(
    filterDailyReporterStatuses(reporters, { employeeId: "user-2" }).map((r) => r.user.id),
    ["user-2"],
  );
  assert.deepEqual(
    filterDailyReporterStatuses(reporters, { templateType: "ASSISTANT" }).map((r) => r.user.id),
    ["user-1"],
  );
  assert.deepEqual(
    filterDailyReporterStatuses(reporters, { state: "NOT_STARTED" }).map((r) => r.user.id),
    ["user-2"],
  );
  assert.deepEqual(filterDailyReporterStatuses(reporters, {}).map((r) => r.user.id), [
    "user-1",
    "user-2",
  ]);
});
