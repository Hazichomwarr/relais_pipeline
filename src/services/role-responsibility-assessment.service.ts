import "server-only";

import type { RoleResponsibilityAssessmentLevel } from "@prisma/client";

import { prisma } from "@/src/lib/prisma";
import {
  isRoleSupportedForRoleResponsibilityAssessment,
  type RoleResponsibilityAnchor,
} from "@/src/lib/role-responsibility-catalog";
import type { AuthenticatedUser } from "@/src/services/authorization.service-core";
// Ticket 25I §10/25H.2A: the calendar-month resolver is reused verbatim
// rather than re-derived — one canonical "what does month X mean"
// authority across every performance-period concept in this codebase,
// despite the target-specific name.
import { resolveCommercialPerformanceTargetPeriod } from "@/src/services/commercial-performance-target.service-core";
import {
  assessRoleResponsibilityItemCore,
  createRoleResponsibilityAssessmentCore,
  deleteRoleResponsibilityAssessmentCore,
  submitRoleResponsibilityAssessmentCore,
  type RoleResponsibilityAssessmentPeriod,
} from "@/src/services/role-responsibility-assessment.service-core";

function toAnchors(value: unknown): readonly RoleResponsibilityAnchor[] {
  return value as RoleResponsibilityAnchor[];
}

export async function createRoleResponsibilityAssessment(
  actor: AuthenticatedUser,
  employeeId: string,
  month: { year: number; month: number },
) {
  const period = resolveCommercialPerformanceTargetPeriod(month);

  return createRoleResponsibilityAssessmentCore(
    actor,
    { employeeId, period },
    {
      findEmployee: (userId) =>
        prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, role: true, active: true },
        }),
      findExisting: (employeeUserId, periodStart, periodEnd) =>
        prisma.roleResponsibilityAssessment.findUnique({
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
        prisma.roleResponsibilityAssessment.create({
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
                responsibilityKey: item.responsibilityKey,
                labelAtEvaluation: item.labelAtEvaluation,
                descriptionAtEvaluation: item.descriptionAtEvaluation,
                maxPoints: item.maxPoints,
                evidenceType: item.evidenceType,
                anchorsSnapshot: item.anchorsSnapshot,
              })),
            },
          },
          select: { id: true },
        }),
    },
  );
}

export async function assessRoleResponsibilityItem(
  actor: AuthenticatedUser,
  assessmentId: string,
  itemId: string,
  level: RoleResponsibilityAssessmentLevel,
  observation: string | null,
) {
  return assessRoleResponsibilityItemCore(
    actor,
    assessmentId,
    itemId,
    level,
    observation,
    {
      findAssessment: (id) =>
        prisma.roleResponsibilityAssessment.findUnique({
          where: { id },
          select: { id: true, status: true, evaluatorUserId: true },
        }),
      findItem: async (id) => {
        const item = await prisma.roleResponsibilityAssessmentItem.findUnique(
          {
            where: { id },
            select: {
              id: true,
              assessmentId: true,
              responsibilityKey: true,
              anchorsSnapshot: true,
            },
          },
        );
        if (!item) return null;
        return { ...item, anchorsSnapshot: toAnchors(item.anchorsSnapshot) };
      },
      update: async (id, selectedLevel, awardedPoints, obs) => {
        await prisma.roleResponsibilityAssessmentItem.update({
          where: { id },
          data: {
            assessmentLevel: selectedLevel,
            awardedPoints,
            observation: obs,
          },
        });
      },
    },
  );
}

export async function submitRoleResponsibilityAssessment(
  actor: AuthenticatedUser,
  assessmentId: string,
) {
  return submitRoleResponsibilityAssessmentCore(actor, assessmentId, {
    findAssessmentWithItems: (id) =>
      prisma.roleResponsibilityAssessment.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          evaluatorUserId: true,
          items: { select: { id: true, awardedPoints: true } },
        },
      }),
    submit: async (id, score) => {
      await prisma.roleResponsibilityAssessment.update({
        where: { id },
        data: { status: "SUBMITTED", score, submittedAt: new Date() },
      });
    },
  });
}

export async function deleteRoleResponsibilityAssessment(
  actor: AuthenticatedUser,
  assessmentId: string,
) {
  return deleteRoleResponsibilityAssessmentCore(actor, assessmentId, {
    findAssessment: (id) =>
      prisma.roleResponsibilityAssessment.findUnique({
        where: { id },
        select: { id: true, status: true, evaluatorUserId: true },
      }),
    delete: async (id) => {
      await prisma.roleResponsibilityAssessment.delete({ where: { id } });
    },
  });
}

/**
 * Ticket 25I §44 — visibility: ADMIN sees every assessment; MANAGER sees
 * only COMMERCIAL-role assessments (the only ones they may ever create),
 * matching canAssessRoleResponsibilities's own boundary rather than
 * introducing a separate visibility rule that could drift from it.
 * Drafts are included — this is the evaluator/management surface, never
 * the employee self-view (deliberately not built in 25I, see the notes
 * doc).
 */
export async function listRoleResponsibilityAssessmentsForManagement(
  actorRole: "ADMIN" | "MANAGER",
) {
  return prisma.roleResponsibilityAssessment.findMany({
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

export async function getRoleResponsibilityAssessmentDetail(
  assessmentId: string,
) {
  const assessment = await prisma.roleResponsibilityAssessment.findUnique({
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
      evaluator: { select: { firstName: true, lastName: true } },
      items: {
        select: {
          id: true,
          responsibilityKey: true,
          labelAtEvaluation: true,
          descriptionAtEvaluation: true,
          maxPoints: true,
          evidenceType: true,
          anchorsSnapshot: true,
          assessmentLevel: true,
          awardedPoints: true,
          observation: true,
        },
      },
    },
  });

  if (!assessment) return null;

  return {
    ...assessment,
    items: assessment.items.map((item) => ({
      ...item,
      anchorsSnapshot: toAnchors(item.anchorsSnapshot),
    })),
  };
}

/**
 * Ticket 25K — exact-period lookup for dashboard composition, mirroring
 * getCommercialPerformanceTarget's "no fallback" contract: `null` when
 * no assessment exists for this exact period, never "the latest one."
 * Deliberately minimal (no items) — the composition dashboard only needs
 * status/score to decide dimension availability; the full detail route
 * already exists at getRoleResponsibilityAssessmentDetail for drill-down.
 */
export async function getRoleResponsibilityAssessmentForEmployeePeriod(
  employeeId: string,
  period: RoleResponsibilityAssessmentPeriod,
) {
  return prisma.roleResponsibilityAssessment.findUnique({
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

/**
 * Ticket 25I — only employees whose role has a defined catalog (§68)
 * appear as pickable in the creation form; an ADMIN employee would only
 * ever produce ROLE_NOT_SUPPORTED, so showing them as an option would be
 * a dead end, not a real choice.
 */
export async function listEligibleEmployeesForRoleResponsibilityAssessment() {
  const users = await prisma.user.findMany({
    where: { active: true, role: { in: ["COMMERCIAL", "MANAGER"] } },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: { id: true, firstName: true, lastName: true, role: true },
  });

  return users.filter((user) =>
    isRoleSupportedForRoleResponsibilityAssessment(user.role),
  );
}

export type RoleResponsibilityAssessmentListItem = Awaited<
  ReturnType<typeof listRoleResponsibilityAssessmentsForManagement>
>[number];
export type RoleResponsibilityAssessmentDetail = Awaited<
  ReturnType<typeof getRoleResponsibilityAssessmentDetail>
>;
