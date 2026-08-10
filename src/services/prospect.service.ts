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
  type ProspectCreationActor,
} from "@/src/services/prospect-creation.service-core";
import {
  assignedUserListSelect,
  buildProspectWhere,
  prospectListOrderBy,
} from "@/src/services/prospect-read.service-core";
import {
  buildWonTransitionActivityData,
  isWonTransition,
} from "@/src/services/prospect-won-transition.service-core";
import { findPossibleSchoolDuplicates } from "@/src/services/school-duplicate.service";
import { ProspectFilters } from "../types/propect.-filters";

export type CreateProspectResult =
  | {
      success: true;
      prospectId: string;
    }
  | {
      success: false;
      code: "POSSIBLE_SCHOOL_DUPLICATE_REVIEW_REQUIRED" | "CREATE_FAILED";
      message: string;
    };

export async function createProspect(
  actor: ProspectCreationActor,
  input: ValidatedProspectInput,
): Promise<CreateProspectResult> {
  return createProspectCore(actor, input, {
    findPossibleDuplicates: (name) => findPossibleSchoolDuplicates(name),
    create: (values, creationActor) =>
      prisma.prospect.create({
        data: buildProspectData(values, creationActor),
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

export type ProspectFollowUpActor = {
  firstName: string;
  lastName: string;
};

export async function updateProspectFollowUp(
  input: ValidatedProspectFollowUpInput,
  actor?: ProspectFollowUpActor,
): Promise<UpdateProspectFollowUpResult> {
  return updateProspectFollowUpScoped({ id: input.prospectId }, input, actor);
}

/**
 * Shared by the admin (unscoped) and commercial (ownership-scoped) callers —
 * the where clause is the only thing that differs between them.
 *
 * This is also the only other place (besides the interaction form's
 * optional status field) that can move a prospect into WON, so it carries
 * the same WON_TRANSITION recording hook (Ticket 18A) — done inside the
 * same transaction as the status write itself.
 */
export async function updateProspectFollowUpScoped(
  where: Prisma.ProspectWhereUniqueInput,
  input: ValidatedProspectFollowUpInput,
  actor?: ProspectFollowUpActor,
): Promise<UpdateProspectFollowUpResult> {
  try {
    const existing = await prisma.prospect.findUnique({
      where,
      select: { status: true },
    });

    if (!existing) {
      return {
        success: false,
        code: "NOT_FOUND",
        message: "Ce prospect n’existe plus.",
      };
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.prospect.update({
        where,
        data: {
          interest: input.interest,
          status: input.status,
          nextAction: input.nextAction,
          followUpDate: input.followUpDate,
        },
      });

      if (isWonTransition(existing.status, input.status)) {
        await transaction.prospectActivity.create({
          data: buildWonTransitionActivityData({
            prospectId: input.prospectId,
            occurredAt: new Date(),
            agentName: actor
              ? `${actor.firstName} ${actor.lastName}`
              : undefined,
          }),
        });
      }
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

