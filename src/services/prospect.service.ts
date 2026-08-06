import "server-only";

import { prisma } from "@/src/lib/prisma";
import { Prisma } from "@prisma/client";
import type {
  ValidatedProspectFollowUpInput,
  ValidatedProspectInput,
} from "@/src/lib/validations/prospect.schema";
import {
  buildProspectData,
  createProspectCore,
} from "@/src/services/prospect-creation.service-core";
import {
  assignedUserListSelect,
  buildProspectWhere,
  prospectListOrderBy,
} from "@/src/services/prospect-read.service-core";
import { findPossibleSchoolDuplicates } from "@/src/services/school-duplicate.service";
import { ProspectFilters } from "../types/propect.-filters";

export type CreateProspectResult =
  | {
      success: true;
      prospectId: string;
    }
  | {
      success: false;
      code:
        | "ASSIGNED_USER_NOT_FOUND"
        | "ASSIGNED_USER_INACTIVE"
        | "ASSIGNED_USER_NOT_COMMERCIAL"
        | "POSSIBLE_SCHOOL_DUPLICATE_REVIEW_REQUIRED"
        | "CREATE_FAILED";
      message: string;
    };

export async function createProspect(
  input: ValidatedProspectInput,
): Promise<CreateProspectResult> {
  return createProspectCore(input, {
    findAssignedUser: (assignedUserId) =>
      prisma.user.findUnique({
        where: { id: assignedUserId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          role: true,
          active: true,
        },
      }),
    findPossibleDuplicates: (name) => findPossibleSchoolDuplicates(name),
    create: (values, agentNameSnapshot) =>
      prisma.prospect.create({
        data: buildProspectData(values, agentNameSnapshot),
        select: { id: true },
      }),
  });
}

export async function getProspects(filters: ProspectFilters = {}) {
  return prisma.prospect.findMany({
    where: buildProspectWhere(filters),
    include: {
      assignedUser: {
        select: assignedUserListSelect,
      },
    },
    orderBy: prospectListOrderBy,
  });
}

export type ProspectListItem = Awaited<ReturnType<typeof getProspects>>[number];

export async function getProspectById(prospectId: string) {
  return prisma.prospect.findUnique({
    where: {
      id: prospectId,
    },
    include: {
      assignedUser: {
        select: assignedUserListSelect,
      },
    },
  });
}

export type ProspectDetail = NonNullable<
  Awaited<ReturnType<typeof getProspectById>>
>;

export type UpdateProspectFollowUpResult =
  | {
      success: true;
    }
  | {
      success: false;
      code: "NOT_FOUND" | "UPDATE_FAILED";
      message: string;
    };

export async function updateProspectFollowUp(
  input: ValidatedProspectFollowUpInput,
): Promise<UpdateProspectFollowUpResult> {
  return updateProspectFollowUpScoped({ id: input.prospectId }, input);
}

/**
 * Shared by the admin (unscoped) and commercial (ownership-scoped) callers —
 * the where clause is the only thing that differs between them.
 */
export async function updateProspectFollowUpScoped(
  where: Prisma.ProspectWhereUniqueInput,
  input: ValidatedProspectFollowUpInput,
): Promise<UpdateProspectFollowUpResult> {
  try {
    await prisma.prospect.update({
      where,
      data: {
        interest: input.interest,
        status: input.status,
        nextAction: input.nextAction,
        followUpDate: input.followUpDate,
      },
    });

    return { success: true };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return {
        success: false,
        code: "NOT_FOUND",
        message: "Ce prospect n’existe plus.",
      };
    }

    console.error("Unable to update prospect follow-up:", error);

    return {
      success: false,
      code: "UPDATE_FAILED",
      message: "Le suivi n’a pas pu être mis à jour. Veuillez réessayer.",
    };
  }
}

