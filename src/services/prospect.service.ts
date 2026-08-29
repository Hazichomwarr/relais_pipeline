import "server-only";

import { prisma } from "@/src/lib/prisma";
import type { ValidatedProspectInput } from "@/src/lib/validations/prospect.schema";
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
        | "ROLE_NOT_ELIGIBLE_FOR_OWNERSHIP"
        | "POSSIBLE_SCHOOL_DUPLICATE_REVIEW_REQUIRED"
        | "CREATE_FAILED";
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

