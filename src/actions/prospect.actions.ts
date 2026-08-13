"use server";

import { revalidatePath } from "next/cache";

import { authorizeAction } from "@/src/actions/authorize-action";
import { prospectSchema } from "@/src/lib/validations/prospect.schema";
import { createProspect } from "@/src/services/prospect.service";
import { requireAuthenticatedUser } from "@/src/services/authorization.service";

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
 * "/" stays a public page (Ticket 13D) so the form can be viewed for
 * training before an account is activated, but submitting now requires
 * authentication (Ticket 15H.1) — the authenticated user always becomes
 * the prospect's Commercial, never a client-supplied assignedUserId.
 */
export async function createProspectAction(
  values: unknown,
): Promise<CreateProspectActionResult> {
  const authorization = await authorizeAction(() => requireAuthenticatedUser());

  if (!authorization.ok) {
    return { success: false, message: authorization.message };
  }

  const parsed = prospectSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      message: "Certaines informations sont invalides.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await createProspect(authorization.user, parsed.data);

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
