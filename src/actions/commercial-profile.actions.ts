"use server";

import { revalidatePath } from "next/cache";

import { commercialProfileUpdateSchema } from "@/src/lib/validations/user.schema";
import { requireCommercial } from "@/src/services/authorization.service";
import { AuthorizationError } from "@/src/services/authorization.service-core";
import { assertCommercialAccess } from "@/src/services/commercial-access.service";
import { CommercialAccessError } from "@/src/services/commercial-access.service-core";
import { updateOwnProfile } from "@/src/services/user.service";

/**
 * Re-verifies active status via assertCommercialAccess (not just
 * requireCommercial's JWT-cached role), so it needs to handle two distinct
 * error classes — the generic authorizeAction() helper only understands
 * AuthorizationError, so this is done inline instead.
 *
 * The password-change action that used to live here moved to
 * src/actions/self-account.actions.ts (Ticket 25F): changing your own
 * password is an authenticated-user capability, not Commercial-specific,
 * so it now authorizes via requireAuthenticatedUser() for every role.
 * This file keeps only the Commercial-specific profile-field edit.
 */
async function authorizeSelf() {
  const user = await requireCommercial();
  return assertCommercialAccess(user.id);
}

export type UpdateOwnProfileActionResult =
  | { success: true }
  | {
      success: false;
      message: string;
      fieldErrors?: Record<string, string[] | undefined>;
    };

export async function updateOwnProfileAction(
  values: unknown,
): Promise<UpdateOwnProfileActionResult> {
  let commercial;

  try {
    commercial = await authorizeSelf();
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof CommercialAccessError) {
      return { success: false, message: error.message };
    }
    throw error;
  }

  const parsed = commercialProfileUpdateSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      message: "Certaines informations sont invalides.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await updateOwnProfile(commercial.id, parsed.data);

  if (!result.success) {
    return { success: false, message: result.message };
  }

  revalidatePath("/dashboard/commercial/profile");

  return { success: true };
}
