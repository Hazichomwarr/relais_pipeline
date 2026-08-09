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
