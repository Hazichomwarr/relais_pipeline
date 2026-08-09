import type { DailyReportStatus, DailyReportTemplateType } from "@prisma/client";

import { formatDailyReportIsoDate } from "@/src/lib/daily-report-date";
import {
  parseDailyReportTemplateData,
  type DailyReportTemplateData,
} from "@/src/lib/validations/daily-report-template-data.schema";
import {
  validateOperationsCoordinatorSubmission,
  type OperationsCoordinatorDailyReportData,
} from "@/src/lib/validations/operations-coordinator-daily-report.schema";

export type DailyReportContentFields = {
  accomplishedToday: string;
  plannedTomorrow: string;
};

export type DailyReportRow = DailyReportContentFields & {
  id: string;
  ownerUserId: string;
  reportDate: Date;
  templateType: DailyReportTemplateType;
  status: DailyReportStatus;
  /** Always a fully typed, default-filled shape — hydrateDailyReportTemplateData normalizes raw/legacy/null JSON before a row ever leaves the service. */
  templateData: DailyReportTemplateData;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type DailyReportOwnerRef = {
  id: string;
  firstName: string;
  lastName: string;
};

export type DailyReportManagementRow = DailyReportRow & {
  owner: DailyReportOwnerRef;
};

export type CreateOwnDailyReportInput = DailyReportContentFields & {
  reportDate: Date;
  /** Raw client-shaped payload — validated against the server-resolved templateType via parseDailyReportTemplateData, never trusted as-is. */
  templateData?: unknown;
};

export type UpdateOwnDailyReportInput = DailyReportContentFields & {
  /** Raw client-shaped payload — validated against the report's immutable stored templateType, so update input can never switch templates. */
  templateData?: unknown;
};

export type DailyReportManagementFilters = {
  ownerUserId?: string;
  status?: DailyReportStatus;
  templateType?: DailyReportTemplateType;
  dateFrom?: Date;
  dateTo?: Date;
};

export type DailyReportSummary = {
  id: string;
  owner: DailyReportOwnerRef;
  reportDate: string;
  templateType: DailyReportTemplateType;
  status: DailyReportStatus;
  submittedAt: string | null;
};

export type DailyReportDetail = DailyReportSummary &
  DailyReportContentFields & {
    templateData: DailyReportTemplateData;
  };

export type DailyReportErrorCode =
  | "DAILY_REPORT_NOT_FOUND"
  | "DAILY_REPORT_NO_TEMPLATE_ASSIGNED"
  | "DAILY_REPORT_ALREADY_EXISTS"
  | "DAILY_REPORT_NOT_EDITABLE"
  | "DAILY_REPORT_ACCOMPLISHED_REQUIRED"
  | "DAILY_REPORT_PLANNED_REQUIRED"
  | "DAILY_REPORT_TEMPLATE_DATA_INVALID"
  | "DAILY_REPORT_PROSPECTING_REQUIREMENTS_NOT_MET"
  | "DAILY_REPORT_CREATE_FAILED"
  | "DAILY_REPORT_UPDATE_FAILED"
  | "DAILY_REPORT_SUBMIT_FAILED";

export type DailyReportWriteResult =
  | { success: true; reportId: string }
  | { success: false; code: DailyReportErrorCode; message: string };

export type DailyReportServiceDependencies = {
  /** Reads the employee's *current* User.dailyReportTemplateType — used only at creation time to snapshot it onto the new report. */
  findOwnerTemplateType: (
    ownerUserId: string,
  ) => Promise<DailyReportTemplateType | null>;
  findOwnByDate: (
    ownerUserId: string,
    reportDate: Date,
  ) => Promise<DailyReportRow | null>;
  findOwnById: (
    ownerUserId: string,
    reportId: string,
  ) => Promise<DailyReportRow | null>;
  listOwn: (ownerUserId: string) => Promise<DailyReportRow[]>;
  create: (
    ownerUserId: string,
    templateType: DailyReportTemplateType,
    reportDate: Date,
    fields: DailyReportContentFields,
    templateData: DailyReportTemplateData,
  ) => Promise<{ id: string }>;
  /** Owner-scoped, DRAFT-only conditional update — matches rows by (id, ownerUserId, status: "DRAFT"), so a foreign, unknown, or already-submitted reportId affects zero rows instead of throwing. */
  updateOwnDraft: (
    ownerUserId: string,
    reportId: string,
    fields: DailyReportContentFields,
    templateData: DailyReportTemplateData,
  ) => Promise<number>;
  /** Owner-scoped, DRAFT-only conditional transition to SUBMITTED — same affected-row-count strategy, and the only path allowed to set submittedAt. */
  submitOwnDraft: (
    ownerUserId: string,
    reportId: string,
    submittedAt: Date,
  ) => Promise<number>;
  listForManagement: (
    filters: DailyReportManagementFilters,
  ) => Promise<DailyReportManagementRow[]>;
  findForManagement: (
    reportId: string,
  ) => Promise<DailyReportManagementRow | null>;
};

export async function getOwnDailyReportForDateCore(
  ownerUserId: string,
  reportDate: Date,
  dependencies: Pick<DailyReportServiceDependencies, "findOwnByDate">,
): Promise<DailyReportRow | null> {
  return dependencies.findOwnByDate(ownerUserId, reportDate);
}

export async function getOwnDailyReportByIdCore(
  ownerUserId: string,
  reportId: string,
  dependencies: Pick<DailyReportServiceDependencies, "findOwnById">,
): Promise<DailyReportRow | null> {
  return dependencies.findOwnById(ownerUserId, reportId);
}

/**
 * reportDate DESC, then a descending id tiebreaker so history renders in a
 * deterministic, repeatable order. (@@unique([ownerUserId, reportDate])
 * makes two rows sharing a reportDate impossible for the same owner, but
 * the tiebreaker keeps the comparator itself well-defined regardless.)
 */
export function compareDailyReportsForOwnHistory(
  left: DailyReportRow,
  right: DailyReportRow,
): number {
  const dateDiff = right.reportDate.getTime() - left.reportDate.getTime();
  if (dateDiff !== 0) {
    return dateDiff;
  }

  if (left.id === right.id) {
    return 0;
  }

  return left.id < right.id ? 1 : -1;
}

export async function listOwnDailyReportsCore(
  ownerUserId: string,
  dependencies: Pick<DailyReportServiceDependencies, "listOwn">,
): Promise<DailyReportRow[]> {
  const reports = await dependencies.listOwn(ownerUserId);
  return [...reports].sort(compareDailyReportsForOwnHistory);
}

export async function createOwnDailyReportCore(
  ownerUserId: string,
  input: CreateOwnDailyReportInput,
  dependencies: Pick<
    DailyReportServiceDependencies,
    "findOwnerTemplateType" | "findOwnByDate" | "create"
  >,
): Promise<DailyReportWriteResult> {
  const templateType = await dependencies.findOwnerTemplateType(ownerUserId);

  if (!templateType) {
    return {
      success: false,
      code: "DAILY_REPORT_NO_TEMPLATE_ASSIGNED",
      message: "Aucun modèle de rapport quotidien ne vous est attribué.",
    };
  }

  const existing = await dependencies.findOwnByDate(
    ownerUserId,
    input.reportDate,
  );

  if (existing) {
    return {
      success: false,
      code: "DAILY_REPORT_ALREADY_EXISTS",
      message: "Un rapport existe déjà pour cette date.",
    };
  }

  const templateDataResult = parseDailyReportTemplateData(
    templateType,
    input.templateData,
  );

  if (!templateDataResult.success) {
    return {
      success: false,
      code: "DAILY_REPORT_TEMPLATE_DATA_INVALID",
      message: templateDataResult.message,
    };
  }

  try {
    const report = await dependencies.create(
      ownerUserId,
      templateType,
      input.reportDate,
      {
        accomplishedToday: input.accomplishedToday,
        plannedTomorrow: input.plannedTomorrow,
      },
      templateDataResult.data,
    );
    return { success: true, reportId: report.id };
  } catch (error) {
    console.error("Unable to create daily report:", error);
    return {
      success: false,
      code: "DAILY_REPORT_CREATE_FAILED",
      message: "Impossible de créer le rapport quotidien.",
    };
  }
}

export async function updateOwnDailyReportCore(
  ownerUserId: string,
  reportId: string,
  input: UpdateOwnDailyReportInput,
  dependencies: Pick<
    DailyReportServiceDependencies,
    "findOwnById" | "updateOwnDraft"
  >,
): Promise<DailyReportWriteResult> {
  const report = await dependencies.findOwnById(ownerUserId, reportId);

  if (!report) {
    return dailyReportNotFound();
  }

  if (report.status !== "DRAFT") {
    return dailyReportNotEditable();
  }

  // Dispatches on the report's own immutable stored templateType, never a
  // client-supplied one — update input has no templateType field at all,
  // so template switching through update input is structurally impossible.
  const templateDataResult = parseDailyReportTemplateData(
    report.templateType,
    input.templateData,
  );

  if (!templateDataResult.success) {
    return {
      success: false,
      code: "DAILY_REPORT_TEMPLATE_DATA_INVALID",
      message: templateDataResult.message,
    };
  }

  try {
    const updatedCount = await dependencies.updateOwnDraft(
      ownerUserId,
      reportId,
      {
        accomplishedToday: input.accomplishedToday,
        plannedTomorrow: input.plannedTomorrow,
      },
      templateDataResult.data,
    );

    if (updatedCount === 0) {
      // Submitted concurrently between the read above and this write.
      return dailyReportNotEditable();
    }

    return { success: true, reportId };
  } catch (error) {
    console.error("Unable to update daily report:", error);
    return {
      success: false,
      code: "DAILY_REPORT_UPDATE_FAILED",
      message: "Impossible de modifier le rapport quotidien.",
    };
  }
}

export async function submitOwnDailyReportCore(
  ownerUserId: string,
  reportId: string,
  dependencies: Pick<
    DailyReportServiceDependencies,
    "findOwnById" | "submitOwnDraft"
  >,
): Promise<DailyReportWriteResult> {
  const report = await dependencies.findOwnById(ownerUserId, reportId);

  if (!report) {
    return dailyReportNotFound();
  }

  if (report.status !== "DRAFT") {
    return dailyReportNotEditable();
  }

  if (!report.accomplishedToday.trim()) {
    return {
      success: false,
      code: "DAILY_REPORT_ACCOMPLISHED_REQUIRED",
      message: "Réalisé aujourd’hui est requis.",
    };
  }

  if (!report.plannedTomorrow.trim()) {
    return {
      success: false,
      code: "DAILY_REPORT_PLANNED_REQUIRED",
      message: "Prévu demain est requis.",
    };
  }

  if (report.templateType === "OPERATIONS_COORDINATOR") {
    const prospectingValidation = validateOperationsCoordinatorSubmission(
      report.templateData as OperationsCoordinatorDailyReportData,
    );

    if (!prospectingValidation.valid) {
      return {
        success: false,
        code: "DAILY_REPORT_PROSPECTING_REQUIREMENTS_NOT_MET",
        message: prospectingValidation.message,
      };
    }
  }

  try {
    // Conditional write (where status = DRAFT) is the only concurrency
    // guard — never "read status, then decide, then update" as the sole
    // protection, so two simultaneous submissions can't both succeed.
    const updatedCount = await dependencies.submitOwnDraft(
      ownerUserId,
      reportId,
      new Date(),
    );

    if (updatedCount === 0) {
      return dailyReportNotEditable();
    }

    return { success: true, reportId };
  } catch (error) {
    console.error("Unable to submit daily report:", error);
    return {
      success: false,
      code: "DAILY_REPORT_SUBMIT_FAILED",
      message: "Impossible de soumettre le rapport quotidien.",
    };
  }
}

/**
 * reportDate DESC, then submittedAt DESC (undated/DRAFT rows sort last
 * within a date), then a descending id tiebreaker for full determinism.
 */
export function compareDailyReportsForManagement(
  left: DailyReportManagementRow,
  right: DailyReportManagementRow,
): number {
  const dateDiff = right.reportDate.getTime() - left.reportDate.getTime();
  if (dateDiff !== 0) {
    return dateDiff;
  }

  const leftSubmittedAt = left.submittedAt?.getTime() ?? 0;
  const rightSubmittedAt = right.submittedAt?.getTime() ?? 0;
  const submittedDiff = rightSubmittedAt - leftSubmittedAt;
  if (submittedDiff !== 0) {
    return submittedDiff;
  }

  if (left.id === right.id) {
    return 0;
  }

  return left.id < right.id ? 1 : -1;
}

export function toDailyReportSummary(
  row: DailyReportManagementRow,
): DailyReportSummary {
  return {
    id: row.id,
    owner: row.owner,
    reportDate: formatDailyReportIsoDate(row.reportDate),
    templateType: row.templateType,
    status: row.status,
    submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
  };
}

export function toDailyReportDetail(
  row: DailyReportManagementRow,
): DailyReportDetail {
  return {
    ...toDailyReportSummary(row),
    accomplishedToday: row.accomplishedToday,
    plannedTomorrow: row.plannedTomorrow,
    templateData: row.templateData,
  };
}

/**
 * ADMIN/MANAGER read-only history (Ticket 19C). Authorization (ADMIN or
 * MANAGER only — see requireDailyReportManagementAccess) happens one layer
 * up; this never grants edit access, regardless of caller role.
 */
export async function listDailyReportsForManagementCore(
  filters: DailyReportManagementFilters,
  dependencies: Pick<DailyReportServiceDependencies, "listForManagement">,
): Promise<DailyReportSummary[]> {
  const reports = await dependencies.listForManagement(filters);
  return [...reports]
    .sort(compareDailyReportsForManagement)
    .map(toDailyReportSummary);
}

export async function getDailyReportForManagementCore(
  reportId: string,
  dependencies: Pick<DailyReportServiceDependencies, "findForManagement">,
): Promise<DailyReportDetail | null> {
  const report = await dependencies.findForManagement(reportId);
  return report ? toDailyReportDetail(report) : null;
}

// ---------------------------------------------------------------------------
// Management dashboard (Ticket 19C) — "today" only. Historical periods reuse
// listDailyReportsForManagementCore above (persisted reports only, no
// derived NOT_STARTED — see the module doc comment near DailyReporterState).
// ---------------------------------------------------------------------------

/**
 * A V1 employee is "expected" to report today when they are active and
 * currently have a template assigned — never inferred from UserRole, never
 * hardcoded to specific people. This says nothing about any date other
 * than today: today's expectation must not be projected onto historical
 * dates, since the app has no assignment-history model (Ticket 19C
 * deliberately does not add one).
 */
export type DailyReportExpectedUser = {
  id: string;
  firstName: string;
  lastName: string;
  dailyReportTemplateType: DailyReportTemplateType;
};

/**
 * Derived UI-only state — never persisted, never added to DailyReportStatus.
 * NOT_STARTED exists only for today's dashboard, computed as
 * (expected reporters) - (reports that exist for today).
 */
export type DailyReporterState = "SUBMITTED" | "DRAFT" | "NOT_STARTED";

export type DailyReporterOperationsSummary = {
  digitalServicesProspects: number | null;
  karmdaSchoolProspects: number | null;
  prospectingException: boolean;
  prospectingExceptionReason: string;
};

export type DailyReporterStatus = {
  user: DailyReportOwnerRef;
  templateType: DailyReportTemplateType;
  state: DailyReporterState;
  reportId: string | null;
  submittedAt: string | null;
  /** Populated whenever a report row exists (draft or submitted) for an OPERATIONS_COORDINATOR reporter — structured numeric data, not free-text prose, so showing it from a draft doesn't violate the "no draft prose in management view" rule below. */
  operationsSummary: DailyReporterOperationsSummary | null;
  /** True only for a SUBMITTED report with non-blank content — a draft's decision/problem text never counts, since the employee hasn't formally reported it yet. */
  hasDecisionNeeded: boolean;
  hasProblemReported: boolean;
};

export type DailyReportAttentionItem = {
  reportId: string;
  owner: DailyReportOwnerRef;
  templateType: DailyReportTemplateType;
  content: string;
  submittedAt: string;
};

export type DailyReportManagementDashboard = {
  businessDate: string;
  summary: {
    expected: number;
    submitted: number;
    draft: number;
    notStarted: number;
  };
  reporters: DailyReporterStatus[];
  decisionsRequired: DailyReportAttentionItem[];
  problemsReported: DailyReportAttentionItem[];
};

export type DailyReportManagementServiceDependencies = {
  /** Active users with a currently assigned template — see DailyReportExpectedUser's doc comment for why this only ever describes "today". */
  listExpectedReporters: () => Promise<DailyReportExpectedUser[]>;
  /** Every report (any owner) for one business date — a single bounded query, composed in memory against the expected-reporter list rather than one query per employee. */
  findReportsForDate: (reportDate: Date) => Promise<DailyReportManagementRow[]>;
};

const REPORTER_STATE_PRIORITY: Record<DailyReporterState, number> = {
  NOT_STARTED: 0,
  DRAFT: 1,
  SUBMITTED: 2,
};

/**
 * NOT_STARTED, then DRAFT, then SUBMITTED — attention-oriented, not simply
 * alphabetical or state-alphabetical, so unfinished reporting always
 * surfaces first for management. Ties broken by lastName, firstName, then
 * a descending id as a final deterministic tiebreaker.
 */
export function compareDailyReporterStatuses(
  left: DailyReporterStatus,
  right: DailyReporterStatus,
): number {
  const priorityDiff =
    REPORTER_STATE_PRIORITY[left.state] - REPORTER_STATE_PRIORITY[right.state];
  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  const lastNameDiff = left.user.lastName.localeCompare(right.user.lastName, "fr", {
    sensitivity: "base",
  });
  if (lastNameDiff !== 0) {
    return lastNameDiff;
  }

  const firstNameDiff = left.user.firstName.localeCompare(
    right.user.firstName,
    "fr",
    { sensitivity: "base" },
  );
  if (firstNameDiff !== 0) {
    return firstNameDiff;
  }

  if (left.user.id === right.user.id) {
    return 0;
  }

  return left.user.id < right.user.id ? -1 : 1;
}

/** submittedAt DESC, then a descending reportId tiebreaker. */
export function compareDailyReportAttentionItems(
  left: DailyReportAttentionItem,
  right: DailyReportAttentionItem,
): number {
  const diff = new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime();
  if (diff !== 0) {
    return diff;
  }

  if (left.reportId === right.reportId) {
    return 0;
  }

  return left.reportId < right.reportId ? 1 : -1;
}

/** Both templates share these exact field names/types (Ticket 19B) — this narrows without re-deriving anything template-specific. */
function getManagementAttentionFields(templateData: DailyReportTemplateData): {
  managementDecisionNeeded: string;
  problemsEncountered: string;
} {
  return templateData as { managementDecisionNeeded: string; problemsEncountered: string };
}

function toOperationsSummary(
  templateData: DailyReportTemplateData,
): DailyReporterOperationsSummary {
  const data = templateData as OperationsCoordinatorDailyReportData;
  return {
    digitalServicesProspects: data.digitalServicesProspects,
    karmdaSchoolProspects: data.karmdaSchoolProspects,
    prospectingException: data.prospectingException,
    prospectingExceptionReason: data.prospectingExceptionReason,
  };
}

function buildAttentionItems(
  submittedReports: DailyReportManagementRow[],
  field: "managementDecisionNeeded" | "problemsEncountered",
): DailyReportAttentionItem[] {
  const items: DailyReportAttentionItem[] = [];

  for (const report of submittedReports) {
    const content = getManagementAttentionFields(report.templateData)[field];

    if (!content.trim()) {
      continue;
    }

    items.push({
      reportId: report.id,
      owner: report.owner,
      templateType: report.templateType,
      content,
      // A SUBMITTED report always has submittedAt (set atomically at
      // submission — Ticket 19A); the non-null assertion documents that
      // invariant rather than working around an uncertain value.
      submittedAt: report.submittedAt!.toISOString(),
    });
  }

  return items.sort(compareDailyReportAttentionItems);
}

/**
 * Pure composition step — no I/O — so it's directly unit-testable without
 * a database: given who is expected to report today and what reports
 * exist for that date, derive every reporter's state, the summary counts,
 * and the two attention queues (SUBMITTED reports only).
 */
export function composeDailyReportManagementDashboard(
  businessDate: Date,
  expectedUsers: DailyReportExpectedUser[],
  reportsForDate: DailyReportManagementRow[],
): DailyReportManagementDashboard {
  const reportsByOwner = new Map(
    reportsForDate.map((report) => [report.ownerUserId, report]),
  );

  const reporters = expectedUsers.map((user): DailyReporterStatus => {
    const report = reportsByOwner.get(user.id) ?? null;
    const state: DailyReporterState = !report
      ? "NOT_STARTED"
      : report.status === "SUBMITTED"
        ? "SUBMITTED"
        : "DRAFT";

    const attentionFields = report
      ? getManagementAttentionFields(report.templateData)
      : null;

    return {
      user: { id: user.id, firstName: user.firstName, lastName: user.lastName },
      templateType: user.dailyReportTemplateType,
      state,
      reportId: report?.id ?? null,
      submittedAt: report?.submittedAt ? report.submittedAt.toISOString() : null,
      operationsSummary:
        report && user.dailyReportTemplateType === "OPERATIONS_COORDINATOR"
          ? toOperationsSummary(report.templateData)
          : null,
      hasDecisionNeeded:
        report?.status === "SUBMITTED" &&
        Boolean(attentionFields?.managementDecisionNeeded.trim()),
      hasProblemReported:
        report?.status === "SUBMITTED" &&
        Boolean(attentionFields?.problemsEncountered.trim()),
    };
  });

  const submittedReports = reportsForDate.filter(
    (report) => report.status === "SUBMITTED",
  );

  return {
    businessDate: formatDailyReportIsoDate(businessDate),
    summary: {
      expected: reporters.length,
      submitted: reporters.filter((reporter) => reporter.state === "SUBMITTED").length,
      draft: reporters.filter((reporter) => reporter.state === "DRAFT").length,
      notStarted: reporters.filter((reporter) => reporter.state === "NOT_STARTED").length,
    },
    reporters: [...reporters].sort(compareDailyReporterStatuses),
    decisionsRequired: buildAttentionItems(submittedReports, "managementDecisionNeeded"),
    problemsReported: buildAttentionItems(submittedReports, "problemsEncountered"),
  };
}

export async function getDailyReportManagementDashboardCore(
  businessDate: Date,
  dependencies: DailyReportManagementServiceDependencies,
): Promise<DailyReportManagementDashboard> {
  const [expectedUsers, reportsForDate] = await Promise.all([
    dependencies.listExpectedReporters(),
    dependencies.findReportsForDate(businessDate),
  ]);

  return composeDailyReportManagementDashboard(businessDate, expectedUsers, reportsForDate);
}

export type DailyReporterFilters = {
  employeeId?: string;
  templateType?: DailyReportTemplateType;
  state?: DailyReporterState;
};

/**
 * Pure array filtering for the "today" reporter list — the dashboard query
 * itself always computes the full picture (so summary counts stay
 * accurate); filters narrow only what's displayed.
 */
export function filterDailyReporterStatuses(
  reporters: DailyReporterStatus[],
  filters: DailyReporterFilters,
): DailyReporterStatus[] {
  return reporters.filter((reporter) => {
    if (filters.employeeId && reporter.user.id !== filters.employeeId) {
      return false;
    }
    if (filters.templateType && reporter.templateType !== filters.templateType) {
      return false;
    }
    if (filters.state && reporter.state !== filters.state) {
      return false;
    }
    return true;
  });
}

function dailyReportNotFound(): DailyReportWriteResult {
  return {
    success: false,
    code: "DAILY_REPORT_NOT_FOUND",
    message: "Le rapport quotidien demandé est introuvable.",
  };
}

function dailyReportNotEditable(): DailyReportWriteResult {
  return {
    success: false,
    code: "DAILY_REPORT_NOT_EDITABLE",
    message: "Ce rapport a déjà été soumis et ne peut plus être modifié.",
  };
}
