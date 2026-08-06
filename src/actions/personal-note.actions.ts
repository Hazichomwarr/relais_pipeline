"use server";

import { revalidatePath } from "next/cache";

import { authorizeAction } from "@/src/actions/authorize-action";
import {
  personalNoteDeleteSchema,
  personalNoteSchema,
  personalNoteUpdateSchema,
} from "@/src/lib/validations/personal-note.schema";
import {
  createMyPersonalNote,
  deleteMyPersonalNote,
  updateMyPersonalNote,
} from "@/src/services/personal-note.service";
import { requireAuthenticatedUser } from "@/src/services/authorization.service";

export type PersonalNoteActionResult =
  | { success: true; noteId: string }
  | {
      success: false;
      message: string;
      fieldErrors?: Record<string, string[] | undefined>;
    };

export async function createPersonalNoteAction(
  values: unknown,
): Promise<PersonalNoteActionResult> {
  const authorization = await authorizeAction(() => requireAuthenticatedUser());

  if (!authorization.ok) {
    return { success: false, message: authorization.message };
  }

  const parsed = personalNoteSchema.safeParse(values);

  if (!parsed.success) {
    return validationFailure(parsed.error.flatten().fieldErrors);
  }

  const result = await createMyPersonalNote(
    authorization.user.id,
    parsed.data,
  );

  return finishMutation(result);
}

export async function updatePersonalNoteAction(
  values: unknown,
): Promise<PersonalNoteActionResult> {
  const authorization = await authorizeAction(() => requireAuthenticatedUser());

  if (!authorization.ok) {
    return { success: false, message: authorization.message };
  }

  const parsed = personalNoteUpdateSchema.safeParse(values);

  if (!parsed.success) {
    return validationFailure(parsed.error.flatten().fieldErrors);
  }

  const { noteId, ...input } = parsed.data;
  const result = await updateMyPersonalNote(
    authorization.user.id,
    noteId,
    input,
  );

  return finishMutation(result);
}

export async function deletePersonalNoteAction(
  values: unknown,
): Promise<PersonalNoteActionResult> {
  const authorization = await authorizeAction(() => requireAuthenticatedUser());

  if (!authorization.ok) {
    return { success: false, message: authorization.message };
  }

  const parsed = personalNoteDeleteSchema.safeParse(values);

  if (!parsed.success) {
    return validationFailure(parsed.error.flatten().fieldErrors);
  }

  const result = await deleteMyPersonalNote(
    authorization.user.id,
    parsed.data.noteId,
  );

  return finishMutation(result);
}

function validationFailure(
  fieldErrors: Record<string, string[] | undefined>,
): PersonalNoteActionResult {
  return {
    success: false,
    message: "Certaines informations de la note sont invalides.",
    fieldErrors,
  };
}

function finishMutation(
  result:
    | Awaited<ReturnType<typeof createMyPersonalNote>>
    | Awaited<ReturnType<typeof updateMyPersonalNote>>
    | Awaited<ReturnType<typeof deleteMyPersonalNote>>,
): PersonalNoteActionResult {
  if (!result.success) {
    return { success: false, message: result.message };
  }

  revalidatePath("/notes");
  revalidatePath(`/notes/${result.noteId}`);

  return result;
}
