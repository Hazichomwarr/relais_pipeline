"use server";

import { revalidatePath } from "next/cache";
import { AuthError } from "next-auth";

import { signIn } from "@/auth";
import { authorizeAction } from "@/src/actions/authorize-action";
import {
  changePasswordSchema,
  loginSchema,
} from "@/src/lib/validations/auth.schema";
import { changePassword } from "@/src/services/auth-credentials.service";
import {
  assertCanChangePassword,
  requireAuthenticatedUser,
} from "@/src/services/authorization.service";

export type LoginActionResult =
  | { success: true }
  | {
      success: false;
      message: string;
      fieldErrors?: Record<string, string[] | undefined>;
    };

export async function loginAction(values: unknown): Promise<LoginActionResult> {
  const parsed = loginSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      message: "Certaines informations sont invalides.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        success: false,
        message: "Adresse e-mail ou mot de passe incorrect.",
      };
    }
    throw error;
  }

  return { success: true };
}

export type ChangePasswordActionResult =
  | { success: true }
  | {
      success: false;
      message: string;
      fieldErrors?: Record<string, string[] | undefined>;
    };

export async function changePasswordAction(
  values: unknown,
): Promise<ChangePasswordActionResult> {
  // Authentication first: an anonymous caller is rejected before any input
  // is even looked at.
  const authentication = await authorizeAction(requireAuthenticatedUser);

  if (!authentication.ok) {
    return { success: false, message: authentication.message };
  }

  const parsed = changePasswordSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      message: "Certaines informations sont invalides.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  // Whether this specific mutation is allowed depends on *which* user is
  // targeted, so this check can only run once the input is validated —
  // but it still gates changePassword() itself, so no mutation ever
  // happens before authorization completes.
  const authorization = await authorizeAction(async () => {
    assertCanChangePassword(authentication.user, parsed.data.userId);
    return authentication.user;
  });

  if (!authorization.ok) {
    return { success: false, message: authorization.message };
  }

  await changePassword(parsed.data.userId, parsed.data.password);
  revalidatePath("/admin/users");

  return { success: true };
}
