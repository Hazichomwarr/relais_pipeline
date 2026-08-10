import type { ValidatedProspectInput } from "@/src/lib/validations/prospect.schema";
import type { PossibleSchoolDuplicate } from "@/src/services/school-duplicate.service-core";

/**
 * The authenticated caller submitting the form (Ticket 15H.1) — "Commercial"
 * means whoever brought the opportunity in, not a formal COMMERCIAL role, so
 * this is any authenticated active User, not a role-narrowed candidate.
 */
export type ProspectCreationActor = {
  id: string;
  firstName: string;
  lastName: string;
};

export type CreateProspectCoreDependencies = {
  findPossibleDuplicates: (
    name: string,
  ) => Promise<PossibleSchoolDuplicate[]>;
  create: (
    input: ValidatedProspectInput,
    actor: ProspectCreationActor,
  ) => Promise<{ id: string }>;
};

export type CreateProspectCoreResult =
  | { success: true; prospectId: string }
  | {
      success: false;
      code: "POSSIBLE_SCHOOL_DUPLICATE_REVIEW_REQUIRED" | "CREATE_FAILED";
      message: string;
    };

export async function createProspectCore(
  actor: ProspectCreationActor,
  input: ValidatedProspectInput,
  dependencies: CreateProspectCoreDependencies,
): Promise<CreateProspectCoreResult> {
  try {
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

    const prospect = await dependencies.create(input, actor);

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
  actor: ProspectCreationActor,
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
    assignedUserId: actor.id,
    agentName: `${actor.firstName} ${actor.lastName}`,
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
