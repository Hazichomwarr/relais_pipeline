import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/src/lib/prisma";
import { hydrateDailyReportTemplateData } from "@/src/lib/validations/daily-report-template-data.schema";
import {
  createOwnDailyReportCore,
  getDailyReportForManagementCore,
  getOwnDailyReportByIdCore,
  getOwnDailyReportForDateCore,
  listDailyReportsForManagementCore,
  listOwnDailyReportsCore,
  submitOwnDailyReportCore,
  updateOwnDailyReportCore,
  type CreateOwnDailyReportInput,
  type DailyReportManagementFilters,
  type DailyReportManagementRow,
  type DailyReportRow,
  type DailyReportServiceDependencies,
  type UpdateOwnDailyReportInput,
} from "@/src/services/daily-report.service-core";

const reportSelect = {
  id: true,
  ownerUserId: true,
  reportDate: true,
  templateType: true,
  status: true,
  accomplishedToday: true,
  plannedTomorrow: true,
  templateData: true,
  submittedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DailyReportSelect;

const ownerRefSelect = {
  id: true,
  firstName: true,
  lastName: true,
} satisfies Prisma.UserSelect;

const managementSelect = {
  ...reportSelect,
  owner: { select: ownerRefSelect },
} satisfies Prisma.DailyReportSelect;

type RawReport = Prisma.DailyReportGetPayload<{ select: typeof reportSelect }>;
type RawReportWithOwner = Prisma.DailyReportGetPayload<{
  select: typeof managementSelect;
}>;

function toDailyReportRow(report: RawReport): DailyReportRow {
  return {
    ...report,
    templateData: hydrateDailyReportTemplateData(
      report.templateType,
      report.templateData,
    ),
  };
}

function toDailyReportManagementRow(
  report: RawReportWithOwner,
): DailyReportManagementRow {
  return {
    ...report,
    templateData: hydrateDailyReportTemplateData(
      report.templateType,
      report.templateData,
    ),
  };
}

function buildManagementWhere(
  filters: DailyReportManagementFilters,
): Prisma.DailyReportWhereInput {
  const reportDate: Prisma.DateTimeFilter | undefined =
    filters.dateFrom || filters.dateTo
      ? {
          ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
          ...(filters.dateTo ? { lte: filters.dateTo } : {}),
        }
      : undefined;

  return {
    ownerUserId: filters.ownerUserId,
    status: filters.status,
    templateType: filters.templateType,
    reportDate,
  };
}

/** Reads the authenticated user's *current* daily-report template assignment — used by /reports (Ticket 19B) to decide which form to render, and by the create dependency below to snapshot it onto a new report. */
export async function getOwnDailyReportTemplateType(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { dailyReportTemplateType: true },
  });
  return user?.dailyReportTemplateType ?? null;
}

const dependencies: DailyReportServiceDependencies = {
  findOwnerTemplateType: getOwnDailyReportTemplateType,

  findOwnByDate: async (ownerUserId, reportDate) => {
    const report = await prisma.dailyReport.findFirst({
      where: { ownerUserId, reportDate },
      select: reportSelect,
    });
    return report ? toDailyReportRow(report) : null;
  },

  findOwnById: async (ownerUserId, reportId) => {
    const report = await prisma.dailyReport.findFirst({
      where: { id: reportId, ownerUserId },
      select: reportSelect,
    });
    return report ? toDailyReportRow(report) : null;
  },

  listOwn: async (ownerUserId) => {
    const reports = await prisma.dailyReport.findMany({
      where: { ownerUserId },
      orderBy: [{ reportDate: "desc" }, { id: "desc" }],
      select: reportSelect,
    });
    return reports.map(toDailyReportRow);
  },

  create: async (ownerUserId, templateType, reportDate, fields, templateData) =>
    prisma.dailyReport.create({
      data: {
        ownerUserId,
        templateType,
        reportDate,
        status: "DRAFT",
        accomplishedToday: fields.accomplishedToday,
        plannedTomorrow: fields.plannedTomorrow,
        templateData,
      },
      select: { id: true },
    }),

  updateOwnDraft: async (ownerUserId, reportId, fields, templateData) => {
    const result = await prisma.dailyReport.updateMany({
      where: { id: reportId, ownerUserId, status: "DRAFT" },
      data: {
        accomplishedToday: fields.accomplishedToday,
        plannedTomorrow: fields.plannedTomorrow,
        templateData,
      },
    });
    return result.count;
  },

  submitOwnDraft: async (ownerUserId, reportId, submittedAt) => {
    const result = await prisma.dailyReport.updateMany({
      where: { id: reportId, ownerUserId, status: "DRAFT" },
      data: { status: "SUBMITTED", submittedAt },
    });
    return result.count;
  },

  listForManagement: async (filters) => {
    const reports = await prisma.dailyReport.findMany({
      where: buildManagementWhere(filters),
      orderBy: [
        { reportDate: "desc" },
        { submittedAt: "desc" },
        { id: "desc" },
      ],
      select: managementSelect,
    });

    return reports.map(toDailyReportManagementRow);
  },

  findForManagement: async (reportId) => {
    const report = await prisma.dailyReport.findUnique({
      where: { id: reportId },
      select: managementSelect,
    });

    return report ? toDailyReportManagementRow(report) : null;
  },
};

export async function getOwnDailyReportForDate(
  userId: string,
  reportDate: Date,
) {
  return getOwnDailyReportForDateCore(userId, reportDate, dependencies);
}

export async function getOwnDailyReportById(userId: string, reportId: string) {
  return getOwnDailyReportByIdCore(userId, reportId, dependencies);
}

export async function listOwnDailyReports(userId: string) {
  return listOwnDailyReportsCore(userId, dependencies);
}

export async function createOwnDailyReport(
  userId: string,
  input: CreateOwnDailyReportInput,
) {
  return createOwnDailyReportCore(userId, input, dependencies);
}

export async function updateOwnDailyReport(
  userId: string,
  reportId: string,
  input: UpdateOwnDailyReportInput,
) {
  return updateOwnDailyReportCore(userId, reportId, input, dependencies);
}

export async function submitOwnDailyReport(userId: string, reportId: string) {
  return submitOwnDailyReportCore(userId, reportId, dependencies);
}

export async function listDailyReportsForManagement(
  filters: DailyReportManagementFilters = {},
) {
  return listDailyReportsForManagementCore(filters, dependencies);
}

export async function getDailyReportForManagement(reportId: string) {
  return getDailyReportForManagementCore(reportId, dependencies);
}

export type DailyReportListItem = Awaited<
  ReturnType<typeof listOwnDailyReports>
>[number];
export type DailyReportManagementListItem = Awaited<
  ReturnType<typeof listDailyReportsForManagement>
>[number];
