import type { UserRole } from "@prisma/client";

import type { ValidatedProspectInput } from "@/src/lib/validations/prospect.schema";
import type { PossibleSchoolDuplicate } from "@/src/services/school-duplicate.service-core";

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
  findPossibleDuplicates: (
    name: string,
  ) => Promise<PossibleSchoolDuplicate[]>;
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
        | "POSSIBLE_SCHOOL_DUPLICATE_REVIEW_REQUIRED"
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

    if (input.product === "KARMDA") {
      const possibleDuplicates = await dependencies.findPossibleDuplicates(
        input.name,
      );

      if (possibleDuplicates.length > 0 && !input.duplicateSchoolReviewed) {
        return {
          success: false,
          code: "POSSIBLE_SCHOOL_DUPLICATE_REVIEW_REQUIRED",
          message:
            "Une école similaire existe déjà. Vérifiez les résultats et confirmez avant de continuer.",
        };
      }
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

/**
 * Explicitly whitelists which validated fields become Prisma create data —
 * this is what keeps workflow-only fields like duplicateSchoolReviewed out
 * of the Prospect table, since nothing here ever spreads the raw input.
 */
export function buildProspectData(
  input: ValidatedProspectInput,
  agentNameSnapshot: string,
) {
  const sharedData = {
    product: input.product,
    name: input.name,
    prospectType: input.prospectType,
    contactName: input.contactName,
    phone: input.phone,
    location: input.location,
    interest: input.interest,
    status: input.status,
    onlinePresence: input.onlinePresence,
    nextAction: input.nextAction,
    followUpDate: input.followUpDate,
    notes: input.notes,
    assignedUserId: input.assignedUserId,
    agentName: agentNameSnapshot,
  };

  switch (input.product) {
    case "KARMDA":
      return {
        ...sharedData,
        schoolType: input.schoolType,
        estimatedStudentCount: input.estimatedStudentCount,
        currentSchoolSystem: input.currentSchoolSystem,
        contactRole: input.contactRole,
      };

    case "LOKARI":
      return {
        ...sharedData,
        propertyOwnerType: input.propertyOwnerType,
        estimatedPropertyCount: input.estimatedPropertyCount,
        propertyCountries: input.propertyCountries,
        currentPropertySystem: input.currentPropertySystem,
      };

    case "NIA":
      return {
        ...sharedData,
        savingsGroupType: input.savingsGroupType,
        estimatedMemberCount: input.estimatedMemberCount,
        contributionFrequency: input.contributionFrequency,
        currentSavingsSystem: input.currentSavingsSystem,
      };

    case "DIGITAL_SERVICES":
      return {
        ...sharedData,
        businessCategory: input.businessCategory,
        requestedService: input.requestedService,
      };
  }
}
