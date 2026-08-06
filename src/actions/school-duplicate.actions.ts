"use server";

import { findPossibleSchoolDuplicates } from "@/src/services/school-duplicate.service";
import type { PossibleSchoolDuplicate } from "@/src/services/school-duplicate.service-core";

export type FindPossibleSchoolDuplicatesActionResult =
  | {
      success: true;
      matches: PossibleSchoolDuplicate[];
    }
  | {
      success: false;
      message: string;
    };

/**
 * Intentionally unauthenticated: called from the same public "/" prospect
 * form as createProspectAction (see Ticket 13D's public-route rule), while
 * the user is still typing, before any assignment or role is known.
 */
export async function findPossibleSchoolDuplicatesAction(
  name: unknown,
): Promise<FindPossibleSchoolDuplicatesActionResult> {
  if (typeof name !== "string") {
    return {
      success: false,
      message: "Nom d’établissement invalide.",
    };
  }

  try {
    const matches = await findPossibleSchoolDuplicates(name);
    return { success: true, matches };
  } catch (error) {
    console.error("Unable to look up possible school duplicates:", error);

    return {
      success: false,
      message:
        "Impossible de vérifier les établissements existants pour le moment. Vous pouvez réessayer avant de soumettre.",
    };
  }
}
