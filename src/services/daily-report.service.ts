import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/src/lib/prisma";
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
  type DailyReportContentFields,
  type DailyReportManagementFilters,
  type DailyReportManagementRow,
  type DailyReportServiceDependencies,
} from "@/src/services/daily-report.service-core";

const reportSelect = {
  id: true,
  ownerUserId: true,
  reportDate: true,
  templateType: true,
  status: true,
  accomplishedToday: true,
  plannedTomorrow: true,
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

type ReportWithOwner = Prisma.DailyReportGetPayload<{
  select: typeof managementSelect;
}>;

function toDailyReportManagementRow(
  report: ReportWithOwner,
): DailyReportManagementRow {
  return report;
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

const dependencies: DailyReportServiceDependencies = {
  findOwnerTemplateType: async (ownerUserId) => {
    const user = await prisma.user.findUnique({
      where: { id: ownerUserId },
      select: { dailyReportTemplateType: true },
    });
    return user?.dailyReportTemplateType ?? null;
  },

  findOwnByDate: async (ownerUserId, reportDate) =>
    prisma.dailyReport.findFirst({
      where: { ownerUserId, reportDate },
      select: reportSelect,
    }),

  findOwnById: async (ownerUserId, reportId) =>
    prisma.dailyReport.findFirst({
      where: { id: reportId, ownerUserId },
      select: reportSelect,
    }),

  listOwn: async (ownerUserId) =>
    prisma.dailyReport.findMany({
      where: { ownerUserId },
      orderBy: [{ reportDate: "desc" }, { id: "desc" }],
      select: reportSelect,
    }),

  create: async (ownerUserId, templateType, reportDate, fields) =>
    prisma.dailyReport.create({
      data: {
        ownerUserId,
        templateType,
        reportDate,
        status: "DRAFT",
        accomplishedToday: fields.accomplishedToday,
        plannedTomorrow: fields.plannedTomorrow,
      },
      select: { id: true },
    }),

  updateOwnDraft: async (ownerUserId, reportId, fields) => {
    const result = await prisma.dailyReport.updateMany({
      where: { id: reportId, ownerUserId, status: "DRAFT" },
      data: {
        accomplishedToday: fields.accomplishedToday,
        plannedTomorrow: fields.plannedTomorrow,
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
  input: DailyReportContentFields,
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
