import type { ProspectActivity, ProspectActivityType } from "@prisma/client";

import type { AuthenticatedUser } from "@/src/services/authorization.service-core";
import type { ValidatedProspectActivityInput } from "@/src/lib/validations/prospect-activity.schema";

export type ProspectActivityReadResult =
  | {
      success: true;
      activities: ProspectActivity[];
    }
  | {
      success: false;
      code: "NOT_FOUND" | "READ_FAILED";
      message: string;
    };

export type ProspectActivityCreateResult =
  | {
      success: true;
      activityId: string;
    }
  | {
      success: false;
      code: "NOT_FOUND" | "CREATE_FAILED";
      message: string;
    };

type ActivityCreateData = {
  prospectId: string;
  type: ProspectActivityType;
  summary: string;
  details?: string;
  occurredAt: Date;
  agentName: string;
};

export type ProspectActivityReadDependencies = {
  findProspect: (prospectId: string) => Promise<{ id: string } | null>;
  findActivities: (prospectId: string) => Promise<ProspectActivity[]>;
};

// Ticket 22B — narrowed to "find the prospect, write one append-only
// activity." This path never reads/writes Prospect.status/interest/
// nextAction/followUpDate and never creates a ProspectAction or
// WON_TRANSITION — that capability lives solely in
// prospect-follow-up.service-core.ts's submitProspectFollowUpCore.
export type ProspectActivityTransaction = {
  findProspect: (prospectId: string) => Promise<{ id: string } | null>;
  createActivity: (data: ActivityCreateData) => Promise<{ id: string }>;
};

export type ProspectActivityCreateDependencies = {
  runTransaction: <T>(
    work: (transaction: ProspectActivityTransaction) => Promise<T>,
  ) => Promise<T>;
};

export async function getProspectActivitiesCore(
  prospectId: string,
  dependencies: ProspectActivityReadDependencies,
): Promise<ProspectActivityReadResult> {
  try {
    const prospect = await dependencies.findProspect(prospectId);

    if (!prospect) {
      return {
        success: false,
        code: "NOT_FOUND",
        message: "Ce prospect n’existe pas.",
      };
    }

    const activities = await dependencies.findActivities(prospectId);

    activities.sort(
      (left, right) =>
        right.occurredAt.getTime() - left.occurredAt.getTime() ||
        right.createdAt.getTime() - left.createdAt.getTime(),
    );

    return { success: true, activities };
  } catch (error) {
    console.error("Unable to read prospect activities:", error);

    return {
      success: false,
      code: "READ_FAILED",
      message: "L’historique des interactions n’a pas pu être chargé.",
    };
  }
}

/**
 * Ticket 22B — attribution is always the authenticated actor, never
 * client-supplied, matching the trust boundary submitProspectFollowUpCore
 * already uses for its own `agentName`.
 */
export async function createProspectActivityCore(
  input: ValidatedProspectActivityInput,
  actor: AuthenticatedUser,
  dependencies: ProspectActivityCreateDependencies,
): Promise<ProspectActivityCreateResult> {
  try {
    return await dependencies.runTransaction(async (transaction) => {
      const prospect = await transaction.findProspect(input.prospectId);

      if (!prospect) {
        return {
          success: false as const,
          code: "NOT_FOUND" as const,
          message: "Ce prospect n’existe plus.",
        };
      }

      const activity = await transaction.createActivity({
        prospectId: input.prospectId,
        type: input.type,
        summary: input.summary,
        details: input.details,
        occurredAt: input.occurredAt,
        agentName: `${actor.firstName} ${actor.lastName}`,
      });

      return {
        success: true as const,
        activityId: activity.id,
      };
    });
  } catch (error) {
    console.error("Unable to create prospect activity:", error);

    return {
      success: false,
      code: "CREATE_FAILED",
      message: "L’interaction n’a pas pu être enregistrée. Veuillez réessayer.",
    };
  }
}
