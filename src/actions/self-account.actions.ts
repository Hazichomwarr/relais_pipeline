"use server";

import { changeOwnPasswordSchema } from "@/src/lib/validations/auth.schema";
import { changeOwnPassword } from "@/src/services/auth-credentials.service";
import { requireAuthenticatedUser } from "@/src/services/authorization.service";
import { AuthorizationError } from "@/src/services/authorization.service-core";
import { assertActiveAccountAccess } from "@/src/services/account-access.service";
import { AccountAccessError } from "@/src/services/account-access.service-core";

/**
 * Ticket 25F: the single self-service password-change workflow for every
 * authenticated role (ADMIN, MANAGER, COMMERCIAL) — generalized from the
 * Commercial-only version that used to live in commercial-profile.actions.ts.
 * requireAuthenticatedUser() carries no role restriction, and
 * assertActiveAccountAccess() re-verifies active status against the
 * database (not just the JWT-cached flag) the same way the Commercial
 * flow already did. The target is always this authenticated actor —
 * never a client-supplied id, since changeOwnPasswordSchema has no
 * userId field for a caller to supply one through.
 */
async function authorizeSelf() {
  const user = await requireAuthenticatedUser();
  return assertActiveAccountAccess(user.id);
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
  let account;

  try {
    account = await authorizeSelf();
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof AccountAccessError) {
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
    account.id,
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
