import type { PersonalNoteCategory } from "@prisma/client";

import type {
  ValidatedPersonalNoteInput,
} from "@/src/lib/validations/personal-note.schema";

export type PersonalNoteRow = {
  id: string;
  category: PersonalNoteCategory;
  title: string;
  content: string | null;
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type PersonalNoteWriteFields = {
  category: PersonalNoteCategory;
  title: string;
  content: string | null;
  pinned: boolean;
};

export type PersonalNoteNotFoundResult = {
  success: false;
  code: "PERSONAL_NOTE_NOT_FOUND";
  message: string;
};

export type PersonalNoteWriteResult =
  | { success: true; noteId: string }
  | PersonalNoteNotFoundResult
  | {
      success: false;
      code:
        | "PERSONAL_NOTE_CREATE_FAILED"
        | "PERSONAL_NOTE_UPDATE_FAILED"
        | "PERSONAL_NOTE_DELETE_FAILED";
      message: string;
    };

export type PersonalNoteDeleteResult =
  | { success: true; noteId: string }
  | PersonalNoteNotFoundResult
  | {
      success: false;
      code: "PERSONAL_NOTE_DELETE_FAILED";
      message: string;
    };

export type PersonalNoteServiceDependencies = {
  list: (userId: string) => Promise<PersonalNoteRow[]>;
  findForOwner: (
    userId: string,
    noteId: string,
  ) => Promise<PersonalNoteRow | null>;
  create: (
    userId: string,
    data: PersonalNoteWriteFields,
  ) => Promise<{ id: string }>;
  /** Owner-scoped update — matches rows by (id, userId) so a foreign or
   * unknown noteId affects zero rows instead of throwing, letting the
   * caller return the same not-found result either way. */
  updateForOwner: (
    userId: string,
    noteId: string,
    data: PersonalNoteWriteFields,
  ) => Promise<number>;
  /** Same owner-scoped affected-row-count strategy as updateForOwner. */
  deleteForOwner: (userId: string, noteId: string) => Promise<number>;
};

/**
 * Pinned notes first, then most-recently-updated first, with a descending
 * id comparison as a deterministic final tiebreaker so equally-pinned,
 * equally-updated notes still sort in a stable, repeatable order.
 */
export function comparePersonalNotesForListing(
  left: PersonalNoteRow,
  right: PersonalNoteRow,
): number {
  if (left.pinned !== right.pinned) {
    return left.pinned ? -1 : 1;
  }

  const updatedDiff = right.updatedAt.getTime() - left.updatedAt.getTime();
  if (updatedDiff !== 0) {
    return updatedDiff;
  }

  if (left.id === right.id) {
    return 0;
  }

  return left.id < right.id ? 1 : -1;
}

export function toPersonalNoteWriteFields(
  input: ValidatedPersonalNoteInput,
): PersonalNoteWriteFields {
  return {
    category: input.category,
    title: input.title,
    content: input.content ?? null,
    pinned: input.pinned ?? false,
  };
}

export async function listMyPersonalNotesCore(
  userId: string,
  dependencies: Pick<PersonalNoteServiceDependencies, "list">,
): Promise<PersonalNoteRow[]> {
  const notes = await dependencies.list(userId);
  return [...notes].sort(comparePersonalNotesForListing);
}

export async function getMyPersonalNoteByIdCore(
  userId: string,
  noteId: string,
  dependencies: Pick<PersonalNoteServiceDependencies, "findForOwner">,
): Promise<PersonalNoteRow | null> {
  return dependencies.findForOwner(userId, noteId);
}

export async function createMyPersonalNoteCore(
  userId: string,
  input: ValidatedPersonalNoteInput,
  dependencies: Pick<PersonalNoteServiceDependencies, "create">,
): Promise<PersonalNoteWriteResult> {
  try {
    const note = await dependencies.create(
      userId,
      toPersonalNoteWriteFields(input),
    );
    return { success: true, noteId: note.id };
  } catch (error) {
    console.error("Unable to create personal note:", error);
    return {
      success: false,
      code: "PERSONAL_NOTE_CREATE_FAILED",
      message: "Impossible de créer la note.",
    };
  }
}

export async function updateMyPersonalNoteCore(
  userId: string,
  noteId: string,
  input: ValidatedPersonalNoteInput,
  dependencies: Pick<PersonalNoteServiceDependencies, "updateForOwner">,
): Promise<PersonalNoteWriteResult> {
  try {
    const updatedCount = await dependencies.updateForOwner(
      userId,
      noteId,
      toPersonalNoteWriteFields(input),
    );

    if (updatedCount === 0) {
      return personalNoteNotFound();
    }

    return { success: true, noteId };
  } catch (error) {
    console.error("Unable to update personal note:", error);
    return {
      success: false,
      code: "PERSONAL_NOTE_UPDATE_FAILED",
      message: "Impossible de modifier la note.",
    };
  }
}

export async function deleteMyPersonalNoteCore(
  userId: string,
  noteId: string,
  dependencies: Pick<PersonalNoteServiceDependencies, "deleteForOwner">,
): Promise<PersonalNoteDeleteResult> {
  try {
    const deletedCount = await dependencies.deleteForOwner(userId, noteId);

    if (deletedCount === 0) {
      return personalNoteNotFound();
    }

    return { success: true, noteId };
  } catch (error) {
    console.error("Unable to delete personal note:", error);
    return {
      success: false,
      code: "PERSONAL_NOTE_DELETE_FAILED",
      message: "Impossible de supprimer la note.",
    };
  }
}

function personalNoteNotFound(): PersonalNoteNotFoundResult {
  return {
    success: false,
    code: "PERSONAL_NOTE_NOT_FOUND",
    message: "La note demandée est introuvable.",
  };
}
