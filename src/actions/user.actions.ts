"use server";

import { revalidatePath } from "next/cache";

import {
  deactivateUserSchema,
  userSchema,
  userUpdateSchema,
} from "@/src/lib/validations/user.schema";
import {
  createUser,
  deactivateUser,
  updateUser,
} from "@/src/services/user.service";

export type UserActionResult =
  | { success: true; userId: string }
  | {
      success: false;
      message: string;
      fieldErrors?: Record<string, string[] | undefined>;
    };

export async function createUserAction(
  values: unknown,
): Promise<UserActionResult> {
  const parsed = userSchema.safeParse(values);

  if (!parsed.success) {
    return validationFailure(parsed.error.flatten().fieldErrors);
  }

  const result = await createUser(parsed.data);
  return finishMutation(result);
}

export async function updateUserAction(
  values: unknown,
): Promise<UserActionResult> {
  const parsed = userUpdateSchema.safeParse(values);

  if (!parsed.success) {
    return validationFailure(parsed.error.flatten().fieldErrors);
  }

  const result = await updateUser(parsed.data);
  return finishMutation(result);
}

export async function deactivateUserAction(
  values: unknown,
): Promise<UserActionResult> {
  const parsed = deactivateUserSchema.safeParse(values);

  if (!parsed.success) {
    return validationFailure(parsed.error.flatten().fieldErrors);
  }

  const result = await deactivateUser(parsed.data.userId);
  return finishMutation(result);
}

function validationFailure(
  fieldErrors: Record<string, string[] | undefined>,
): UserActionResult {
  return {
    success: false,
    message: "Certaines informations de l’utilisateur sont invalides.",
    fieldErrors,
  };
}

function finishMutation(
  result:
    | Awaited<ReturnType<typeof createUser>>
    | Awaited<ReturnType<typeof deactivateUser>>,
): UserActionResult {
  if (!result.success) {
    return { success: false, message: result.message };
  }

  revalidatePath("/admin/users");
  revalidatePath("/");
  revalidatePath("/admin");
  return result;
}
