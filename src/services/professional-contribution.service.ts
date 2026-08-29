import "server-only";

import { prisma } from "@/src/lib/prisma";
import {
  isRoleSupportedForProfessionalContribution,
  type ProfessionalContributionAnchor,
} from "@/src/lib/professional-contribution-catalog";
import type { AuthenticatedUser } from "@/src/services/authorization.service-core";
// Ticket 25J §10/25I: the calendar-month resolver is reused verbatim —
// one canonical "what does month X mean" authority across every
// performance-period concept in this codebase.
import { resolveCommercialPerformanceTargetPeriod } from "@/src/services/commercial-performance-target.service-core";
import {
  assessProfessionalContributionItemCore,
  createProfessionalContributionAssessmentCore,
  deleteProfessionalContributionAssessmentCore,
  submitProfessionalContributionAssessmentCore,
  type ProfessionalContributionAssessmentPeriod,
} from "@/src/services/professional-contribution.service-core";

function toAnchors(value: unknown): readonly ProfessionalContributionAnchor[] {
  return value as ProfessionalContributionAnchor[];
}

export async function createProfessionalContributionAssessment(
  actor: AuthenticatedUser,
  employeeId: string,
  month: { year: number; month: number },
) {
  const period = resolveCommercialPerformanceTargetPeriod(month);

  return createProfessionalContributionAssessmentCore(
    actor,
    { employeeId, period },
    {
      findEmployee: (userId) =>
        prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, role: true, active: true },
        }),
      findExisting: (employeeUserId, periodStart, periodEnd) =>
        prisma.professionalContributionAssessment.findUnique({
          where: {
            employeeUserId_periodStart_periodEnd: {
              employeeUserId,
              periodStart,
              periodEnd,
            },
          },
          select: { id: true },
        }),
      create: (fields) =>
        prisma.professionalContributionAssessment.create({
          data: {
            employeeUserId: fields.employeeUserId,
            roleAtEvaluation: fields.roleAtEvaluation,
            periodStart: fields.periodStart,
            periodEnd: fields.periodEnd,
            policyVersion: fields.policyVersion,
            evaluatorUserId: fields.evaluatorUserId,
            evaluatorRoleAtEvent: fields.evaluatorRoleAtEvent,
            items: {
              create: fields.items.map((item) => ({
                traitKey: item.traitKey,
                labelAtEvaluation: item.labelAtEvaluation,
                descriptionAtEvaluation: item.descriptionAtEvaluation,
                maxPoints: item.maxPoints,
                anchorsSnapshot: item.anchorsSnapshot,
              })),
            },
          },
          select: { id: true },
        }),
    },
  );
}

export async function assessProfessionalContributionItem(
  actor: AuthenticatedUser,
  assessmentId: string,
  itemId: string,
  level: number,
  observation: string | null,
) {
  return assessProfessionalContributionItemCore(
    actor,
    assessmentId,
    itemId,
    level,
    observation,
    {
      findAssessment: (id) =>
        prisma.professionalContributionAssessment.findUnique({
          where: { id },
          select: { id: true, status: true, evaluatorUserId: true },
        }),
      findItem: (id) =>
        prisma.professionalContributionAssessmentItem.findUnique({
          where: { id },
          select: {
            id: true,
            assessmentId: true,
            traitKey: true,
            maxPoints: true,
          },
        }),
      update: async (id, selectedLevel, awardedPoints, obs) => {
        await prisma.professionalContributionAssessmentItem.update({
          where: { id },
          data: { selectedLevel, awardedPoints, observation: obs },
        });
      },
    },
  );
}

export async function submitProfessionalContributionAssessment(
  actor: AuthenticatedUser,
  assessmentId: string,
) {
  return submitProfessionalContributionAssessmentCore(actor, assessmentId, {
    findAssessmentWithItems: (id) =>
      prisma.professionalContributionAssessment.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          evaluatorUserId: true,
          items: { select: { id: true, awardedPoints: true } },
        },
      }),
    submit: async (id, score) => {
      await prisma.professionalContributionAssessment.update({
        where: { id },
        data: { status: "SUBMITTED", score, submittedAt: new Date() },
      });
    },
  });
}

export async function deleteProfessionalContributionAssessment(
  actor: AuthenticatedUser,
  assessmentId: string,
) {
  return deleteProfessionalContributionAssessmentCore(actor, assessmentId, {
    findAssessment: (id) =>
      prisma.professionalContributionAssessment.findUnique({
        where: { id },
        select: { id: true, status: true, evaluatorUserId: true },
      }),
    delete: async (id) => {
      await prisma.professionalContributionAssessment.delete({
        where: { id },
      });
    },
  });
}

/**
 * Ticket 25K — exact-period lookup for dashboard composition, same
 * "no fallback" contract as
 * getRoleResponsibilityAssessmentForEmployeePeriod.
 */
export async function getProfessionalContributionAssessmentForEmployeePeriod(
  employeeId: string,
  period: ProfessionalContributionAssessmentPeriod,
) {
  return prisma.professionalContributionAssessment.findUnique({
    where: {
      employeeUserId_periodStart_periodEnd: {
        employeeUserId: employeeId,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
      },
    },
    select: { id: true, status: true, score: true, maxScore: true },
  });
}

/** Same discoverability filter as 25I's listEligibleEmployeesForRoleResponsibilityAssessment. */
export async function listEligibleEmployeesForProfessionalContribution() {
  const users = await prisma.user.findMany({
    where: { active: true, role: { in: ["COMMERCIAL", "MANAGER"] } },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: { id: true, firstName: true, lastName: true, role: true },
  });

  return users.filter((user) =>
    isRoleSupportedForProfessionalContribution(user.role),
  );
}

/** Same visibility rule as 25I's management listing: ADMIN sees every assessment, MANAGER sees only COMMERCIAL-role ones. */
export async function listProfessionalContributionAssessmentsForManagement(
  actorRole: "ADMIN" | "MANAGER",
) {
  return prisma.professionalContributionAssessment.findMany({
    where: actorRole === "MANAGER" ? { roleAtEvaluation: "COMMERCIAL" } : {},
    orderBy: [{ periodStart: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      periodStart: true,
      periodEnd: true,
      status: true,
      score: true,
      maxScore: true,
      roleAtEvaluation: true,
      employee: { select: { id: true, firstName: true, lastName: true } },
      evaluator: { select: { firstName: true, lastName: true } },
      createdAt: true,
    },
  });
}

export async function getProfessionalContributionAssessmentDetail(
  assessmentId: string,
) {
  const assessment = await prisma.professionalContributionAssessment.findUnique(
    {
      where: { id: assessmentId },
      select: {
        id: true,
        employeeUserId: true,
        roleAtEvaluation: true,
        periodStart: true,
        periodEnd: true,
        policyVersion: true,
        evaluatorUserId: true,
        evaluatorRoleAtEvent: true,
        status: true,
        score: true,
        maxScore: true,
        submittedAt: true,
        employee: { select: { firstName: true, lastName: true } },
        items: {
          select: {
            id: true,
            traitKey: true,
            labelAtEvaluation: true,
            descriptionAtEvaluation: true,
            maxPoints: true,
            anchorsSnapshot: true,
            selectedLevel: true,
            awardedPoints: true,
            observation: true,
          },
        },
      },
    },
  );

  if (!assessment) return null;

  return {
    ...assessment,
    items: assessment.items.map((item) => ({
      ...item,
      anchorsSnapshot: toAnchors(item.anchorsSnapshot),
    })),
  };
}

export type ProfessionalContributionAssessmentListItem = Awaited<
  ReturnType<typeof listProfessionalContributionAssessmentsForManagement>
>[number];
export type ProfessionalContributionAssessmentDetail = Awaited<
  ReturnType<typeof getProfessionalContributionAssessmentDetail>
>;
