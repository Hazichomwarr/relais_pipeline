import type { UserRole } from "@prisma/client";

import type { ValidatedProspectInput } from "@/src/lib/validations/prospect.schema";

export type AssignedUserCandidate = {
  id: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  active: boolean;
};

export type CreateProspectCoreDependencies = {
  findAssignedUser: (
    assignedUserId: string,
  ) => Promise<AssignedUserCandidate | null>;
  create: (
    input: ValidatedProspectInput,
    agentNameSnapshot: string,
  ) => Promise<{ id: string }>;
};

export type CreateProspectCoreResult =
  | { success: true; prospectId: string }
  | {
      success: false;
      code:
        | "ASSIGNED_USER_NOT_FOUND"
        | "ASSIGNED_USER_INACTIVE"
        | "ASSIGNED_USER_NOT_COMMERCIAL"
        | "CREATE_FAILED";
      message: string;
    };

export async function createProspectCore(
  input: ValidatedProspectInput,
  dependencies: CreateProspectCoreDependencies,
): Promise<CreateProspectCoreResult> {
  try {
    const assignedUser = await dependencies.findAssignedUser(
      input.assignedUserId,
    );

    if (!assignedUser) {
      return {
        success: false,
        code: "ASSIGNED_USER_NOT_FOUND",
        message: "Le commercial sélectionné n’existe plus.",
      };
    }

    if (!assignedUser.active) {
      return {
        success: false,
        code: "ASSIGNED_USER_INACTIVE",
        message:
          "Ce commercial est désactivé et ne peut plus recevoir de nouveaux prospects.",
      };
    }

    if (assignedUser.role !== "COMMERCIAL") {
      return {
        success: false,
        code: "ASSIGNED_USER_NOT_COMMERCIAL",
        message: "L’utilisateur sélectionné n’a pas le rôle commercial.",
      };
    }

    const agentNameSnapshot = `${assignedUser.firstName} ${assignedUser.lastName}`;
    const prospect = await dependencies.create(input, agentNameSnapshot);

    return { success: true, prospectId: prospect.id };
  } catch (error) {
    console.error("Unable to create prospect:", error);
    return {
      success: false,
      code: "CREATE_FAILED",
      message: "Le prospect n’a pas pu être enregistré. Veuillez réessayer.",
    };
  }
}
