import assert from "node:assert/strict";
import test from "node:test";
import type { DailyReportTemplateType } from "@prisma/client";

import {
  compareDailyReportsForManagement,
  compareDailyReportsForOwnHistory,
  createOwnDailyReportCore,
  getDailyReportForManagementCore,
  getOwnDailyReportByIdCore,
  getOwnDailyReportForDateCore,
  listDailyReportsForManagementCore,
  listOwnDailyReportsCore,
  submitOwnDailyReportCore,
  toDailyReportDetail,
  toDailyReportSummary,
  updateOwnDailyReportCore,
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
  return {
    id,
    ownerUserId,
    reportDate: new Date("2026-08-01T00:00:00.000Z"),
    templateType: "ASSISTANT",
    status: "DRAFT",
    accomplishedToday: "Réalisé du jour.",
    plannedTomorrow: "Prévu demain.",
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

    create: async (ownerUserId, templateType, reportDate, fields) => {
      counter += 1;
      const id = `report-${counter}`;
      reports.push(
        makeReport(id, ownerUserId, {
          reportDate,
          templateType,
          status: "DRAFT",
          accomplishedToday: fields.accomplishedToday,
          plannedTomorrow: fields.plannedTomorrow,
          submittedAt: null,
        }),
      );
      return { id };
    },

    // Mirrors the real Prisma updateMany({ where: { id, ownerUserId, status: "DRAFT" } })
    // — only mutates (and only counts as affected) when all three still match.
    updateOwnDraft: async (ownerUserId, reportId, fields) => {
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
  store.dependencies.updateOwnDraft = async (ownerUserId, reportId, fields) => {
    store.reports[0].status = "SUBMITTED";
    return originalUpdateOwnDraft(ownerUserId, reportId, fields);
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
