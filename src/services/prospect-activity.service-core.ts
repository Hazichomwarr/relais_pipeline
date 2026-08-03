import type {
  FollowUpAction,
  InterestLevel,
  ProspectActivity,
  ProspectActivityType,
  ProspectStatus,
} from "@prisma/client";

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

export type ProspectStateUpdates = {
  interest?: InterestLevel;
  status?: ProspectStatus;
  nextAction?: FollowUpAction;
  followUpDate?: Date;
};

type ActivityCreateData = {
  prospectId: string;
  type: ProspectActivityType;
  summary: string;
  details?: string;
  occurredAt: Date;
  agentName?: string;
};

export type ProspectActivityReadDependencies = {
  findProspect: (prospectId: string) => Promise<{ id: string } | null>;
  findActivities: (prospectId: string) => Promise<ProspectActivity[]>;
};

export type ProspectActivityTransaction = {
  findProspect: (prospectId: string) => Promise<{ id: string } | null>;
  createActivity: (
    data: ActivityCreateData,
  ) => Promise<{ id: string }>;
  updateProspect: (
    prospectId: string,
    data: ProspectStateUpdates,
  ) => Promise<void>;
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

export async function createProspectActivityCore(
  input: ValidatedProspectActivityInput,
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
        agentName: input.agentName,
      });

      const prospectUpdates = buildProspectUpdates(input);

      if (Object.keys(prospectUpdates).length > 0) {
        await transaction.updateProspect(input.prospectId, prospectUpdates);
      }

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

export function buildProspectUpdates(
  input: ValidatedProspectActivityInput,
): ProspectStateUpdates {
  const data: ProspectStateUpdates = {};

  if (input.interest !== undefined) {
    data.interest = input.interest;
  }
  if (input.status !== undefined) {
    data.status = input.status;
  }
  if (input.nextAction !== undefined) {
    data.nextAction = input.nextAction;
  }
  if (input.followUpDate !== undefined) {
    data.followUpDate = input.followUpDate;
  }

  return data;
}
