"use server";

import { revalidatePath } from "next/cache";

import { authorizeAction } from "@/src/actions/authorize-action";
import {
  prospectFollowUpSchema,
  prospectSchema,
} from "@/src/lib/validations/prospect.schema";
import {
  createProspect,
  updateProspectFollowUp,
} from "@/src/services/prospect.service";
import { requireRole } from "@/src/services/authorization.service";

export type CreateProspectActionResult =
  | {
      success: true;
      prospectId: string;
    }
  | {
      success: false;
      message: string;
      fieldErrors?: Record<string, string[] | undefined>;
    };

/**
 * Intentionally unauthenticated: this is the public field-rep prospect
 * submission form served from "/" (see Ticket 13D's public-route rule).
 */
export async function createProspectAction(
  values: unknown,
): Promise<CreateProspectActionResult> {
  const parsed = prospectSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      message: "Certaines informations sont invalides.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await createProspect(parsed.data);

  if (!result.success) {
    if (result.code === "POSSIBLE_SCHOOL_DUPLICATE_REVIEW_REQUIRED") {
      return {
        success: false,
        message: result.message,
        fieldErrors: {
          duplicateSchoolReviewed: [
            "Vérifiez les établissements similaires ou confirmez qu’il s’agit bien d’un nouveau prospect.",
          ],
        },
      };
    }

    return {
      success: false,
      message: result.message,
    };
  }

  revalidatePath("/admin");

  return result;
}

export type UpdateProspectFollowUpActionResult =
  | {
      success: true;
      message: string;
    }
  | {
      success: false;
      message: string;
      fieldErrors?: Record<string, string[] | undefined>;
    };

export async function updateProspectFollowUpAction(
  values: unknown,
): Promise<UpdateProspectFollowUpActionResult> {
  const authorization = await authorizeAction(() =>
    requireRole("ADMIN", "MANAGER"),
  );

  if (!authorization.ok) {
    return { success: false, message: authorization.message };
  }

  const parsed = prospectFollowUpSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      message: "Certaines informations de suivi sont invalides.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await updateProspectFollowUp(parsed.data);

  if (!result.success) {
    return {
      success: false,
      message: result.message,
    };
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/prospects/${parsed.data.prospectId}`);

  return {
    success: true,
    message: "Le suivi du prospect a été mis à jour.",
  };
}
