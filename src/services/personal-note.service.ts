import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/src/lib/prisma";
import type { ValidatedPersonalNoteInput } from "@/src/lib/validations/personal-note.schema";
import {
  createMyPersonalNoteCore,
  deleteMyPersonalNoteCore,
  getMyPersonalNoteByIdCore,
  listMyPersonalNotesCore,
  updateMyPersonalNoteCore,
  type PersonalNoteWriteFields,
} from "@/src/services/personal-note.service-core";

const personalNoteSelect = {
  id: true,
  category: true,
  title: true,
  content: true,
  pinned: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PersonalNoteSelect;

const dependencies = {
  list: (userId: string) =>
    prisma.personalNote.findMany({
      where: { userId },
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }, { id: "desc" }],
      select: personalNoteSelect,
    }),
  findForOwner: (userId: string, noteId: string) =>
    prisma.personalNote.findFirst({
      where: { id: noteId, userId },
      select: personalNoteSelect,
    }),
  create: (userId: string, data: PersonalNoteWriteFields) =>
    prisma.personalNote.create({
      data: {
        userId,
        category: data.category,
        title: data.title,
        content: data.content,
        pinned: data.pinned,
      },
      select: { id: true },
    }),
  updateForOwner: async (
    userId: string,
    noteId: string,
    data: PersonalNoteWriteFields,
  ) => {
    const result = await prisma.personalNote.updateMany({
      where: { id: noteId, userId },
      data: {
        category: data.category,
        title: data.title,
        content: data.content,
        pinned: data.pinned,
      },
    });
    return result.count;
  },
  deleteForOwner: async (userId: string, noteId: string) => {
    const result = await prisma.personalNote.deleteMany({
      where: { id: noteId, userId },
    });
    return result.count;
  },
};

export async function listMyPersonalNotes(userId: string) {
  return listMyPersonalNotesCore(userId, dependencies);
}

export async function getMyPersonalNoteById(userId: string, noteId: string) {
  return getMyPersonalNoteByIdCore(userId, noteId, dependencies);
}

export async function createMyPersonalNote(
  userId: string,
  input: ValidatedPersonalNoteInput,
) {
  return createMyPersonalNoteCore(userId, input, dependencies);
}

export async function updateMyPersonalNote(
  userId: string,
  noteId: string,
  input: ValidatedPersonalNoteInput,
) {
  return updateMyPersonalNoteCore(userId, noteId, input, dependencies);
}

export async function deleteMyPersonalNote(userId: string, noteId: string) {
  return deleteMyPersonalNoteCore(userId, noteId, dependencies);
}

export type PersonalNoteListItem = Awaited<
  ReturnType<typeof listMyPersonalNotes>
>[number];
