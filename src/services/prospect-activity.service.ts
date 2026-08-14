import "server-only";

import { prisma } from "@/src/lib/prisma";
import type { ValidatedProspectActivityInput } from "@/src/lib/validations/prospect-activity.schema";
import type { AuthenticatedUser } from "@/src/services/authorization.service-core";
import {
  createProspectActivityCore,
  getProspectActivitiesCore,
  type ProspectActivityCreateResult,
  type ProspectActivityReadResult,
} from "@/src/services/prospect-activity.service-core";

export type GetProspectActivitiesResult = ProspectActivityReadResult;

export async function getProspectActivities(
  prospectId: string,
): Promise<GetProspectActivitiesResult> {
  return getProspectActivitiesCore(prospectId, {
    findProspect: (id) =>
      prisma.prospect.findUnique({
        where: { id },
        select: { id: true },
      }),
    findActivities: (id) =>
      prisma.prospectActivity.findMany({
        where: { prospectId: id },
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      }),
  });
}

export type ProspectActivityListItem = Extract<
  GetProspectActivitiesResult,
  { success: true }
>["activities"][number];

export type CreateProspectActivityResult = ProspectActivityCreateResult;

export async function createProspectActivity(
  input: ValidatedProspectActivityInput,
  actor: AuthenticatedUser,
): Promise<CreateProspectActivityResult> {
  return createProspectActivityCore(input, actor, {
    runTransaction: (work) =>
      prisma.$transaction((transaction) =>
        work({
          findProspect: (id) =>
            transaction.prospect.findUnique({
              where: { id },
              select: { id: true },
            }),
          createActivity: (data) =>
            transaction.prospectActivity.create({
              data,
              select: { id: true },
            }),
        }),
      ),
  });
}
