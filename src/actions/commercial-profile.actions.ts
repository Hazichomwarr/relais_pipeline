"use server";

import { revalidatePath } from "next/cache";

import { changeOwnPasswordSchema } from "@/src/lib/validations/auth.schema";
import { commercialProfileUpdateSchema } from "@/src/lib/validations/user.schema";
import { changeOwnPassword } from "@/src/services/auth-credentials.service";
import { requireCommercial } from "@/src/services/authorization.service";
import { AuthorizationError } from "@/src/services/authorization.service-core";
import { assertCommercialAccess } from "@/src/services/commercial-access.service";
import { CommercialAccessError } from "@/src/services/commercial-access.service-core";
import { updateOwnProfile } from "@/src/services/user.service";

/**
 * Both actions here re-verify active status via assertCommercialAccess (not
 * just requireCommercial's JWT-cached role), so they need to handle two
 * distinct error classes — the generic authorizeAction() helper only
 * understands AuthorizationError, so this is done inline instead.
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

export type ChangeOwnPasswordActionResult =
  | { success: true; message: string }
  | {
      success: false;
      message: string;
      fieldErrors?: Record<string, string[] | undefined>;
    };

export async function changeOwnPasswordAction(
  values: unknown,
): Promise<ChangeOwnPasswordActionResult> {
  let commercial;

  try {
    commercial = await authorizeSelf();
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof CommercialAccessError) {
      return { success: false, message: error.message };
    }
    throw error;
  }

  const parsed = changeOwnPasswordSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      message: "Certaines informations sont invalides.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await changeOwnPassword(
    commercial.id,
    parsed.data.currentPassword,
    parsed.data.newPassword,
  );

  if (!result.success) {
    return { success: false, message: result.message };
  }

  return {
    success: true,
    message: "Votre mot de passe a été mis à jour.",
  };
}
