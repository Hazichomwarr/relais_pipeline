import assert from "node:assert/strict";
import test from "node:test";

import { personalNoteSchema } from "@/src/lib/validations/personal-note.schema";
import type { ValidatedPersonalNoteInput } from "@/src/lib/validations/personal-note.schema";
import {
  comparePersonalNotesForListing,
  createMyPersonalNoteCore,
  deleteMyPersonalNoteCore,
  getMyPersonalNoteByIdCore,
  listMyPersonalNotesCore,
  updateMyPersonalNoteCore,
  type PersonalNoteRow,
  type PersonalNoteServiceDependencies,
} from "./personal-note.service-core";

type StoredNote = PersonalNoteRow & { userId: string };

function validInput(
  overrides: Partial<ValidatedPersonalNoteInput> = {},
): ValidatedPersonalNoteInput {
  return {
    category: "URGENT_TODO",
    title: "Relancer l’école Sainte-Marie",
    content: "Appeler avant vendredi.",
    pinned: false,
    ...overrides,
  };
}

test("creates a note owned by the given user and persists its fields", async () => {
  const store = createNoteStore();
  const result = await createMyPersonalNoteCore(
    "user-1",
    validInput({ category: "RELAIS_IDEA", title: "Idée de fonctionnalité" }),
    store.dependencies,
  );

  assert.equal(result.success, true);
  assert.equal(store.notes.length, 1);
  assert.equal(store.notes[0].userId, "user-1");
  assert.equal(store.notes[0].category, "RELAIS_IDEA");
  assert.equal(store.notes[0].title, "Idée de fonctionnalité");
});

test("normalizes an omitted optional content to null on create", async () => {
  const store = createNoteStore();
  const parsed = personalNoteSchema.parse({
    category: "OTHER",
    title: "Note sans contenu",
  });
  const result = await createMyPersonalNoteCore(
    "user-1",
    parsed,
    store.dependencies,
  );

  assert.equal(result.success, true);
  assert.equal(store.notes[0].content, null);
  assert.equal(store.notes[0].pinned, false);
});

test("list returns only the authenticated user's notes", async () => {
  const store = createNoteStore([
    makeNote("note-1", "user-1"),
    makeNote("note-2", "user-2"),
  ]);

  const notes = await listMyPersonalNotesCore("user-1", store.dependencies);

  assert.deepEqual(
    notes.map((note) => note.id),
    ["note-1"],
  );
});

test("list supports an empty result", async () => {
  const store = createNoteStore();
  const notes = await listMyPersonalNotesCore("user-1", store.dependencies);

  assert.deepEqual(notes, []);
});

test("list orders pinned notes first, then most recently updated", async () => {
  const store = createNoteStore([
    makeNote("note-1", "user-1", {
      pinned: false,
      updatedAt: new Date("2026-08-05T12:00:00.000Z"),
    }),
    makeNote("note-2", "user-1", {
      pinned: true,
      updatedAt: new Date("2026-08-01T12:00:00.000Z"),
    }),
    makeNote("note-3", "user-1", {
      pinned: false,
      updatedAt: new Date("2026-08-06T12:00:00.000Z"),
    }),
  ]);

  const notes = await listMyPersonalNotesCore("user-1", store.dependencies);

  assert.deepEqual(
    notes.map((note) => note.id),
    ["note-2", "note-3", "note-1"],
  );
});

test("comparePersonalNotesForListing falls back to a deterministic descending id order", () => {
  const sameUpdatedAt = new Date("2026-08-01T12:00:00.000Z");
  const left = makeNote("note-a", "user-1", { updatedAt: sameUpdatedAt });
  const right = makeNote("note-b", "user-1", { updatedAt: sameUpdatedAt });

  assert.ok(comparePersonalNotesForListing(left, right) > 0);
  assert.ok(comparePersonalNotesForListing(right, left) < 0);
  assert.equal(comparePersonalNotesForListing(left, left), 0);
});

test("owner can read their own note", async () => {
  const store = createNoteStore([makeNote("note-1", "user-1")]);
  const note = await getMyPersonalNoteByIdCore(
    "user-1",
    "note-1",
    store.dependencies,
  );

  assert.equal(note?.id, "note-1");
});

test("a foreign note and an unknown note both resolve to null", async () => {
  const store = createNoteStore([makeNote("note-1", "user-1")]);

  const foreign = await getMyPersonalNoteByIdCore(
    "user-2",
    "note-1",
    store.dependencies,
  );
  const unknown = await getMyPersonalNoteByIdCore(
    "user-1",
    "missing-note",
    store.dependencies,
  );

  assert.equal(foreign, null);
  assert.equal(unknown, null);
});

test("owner can update category, title, content, and pinned", async () => {
  const store = createNoteStore([makeNote("note-1", "user-1")]);
  const result = await updateMyPersonalNoteCore(
    "user-1",
    "note-1",
    validInput({
      category: "SCHOOL_DOCUMENTS",
      title: "Titre modifié",
      content: "Contenu modifié",
      pinned: true,
    }),
    store.dependencies,
  );

  assert.equal(result.success, true);
  assert.equal(store.notes[0].category, "SCHOOL_DOCUMENTS");
  assert.equal(store.notes[0].title, "Titre modifié");
  assert.equal(store.notes[0].content, "Contenu modifié");
  assert.equal(store.notes[0].pinned, true);
  assert.equal(store.notes[0].userId, "user-1");
});

test("a foreign user cannot update someone else's note, and the note is left untouched", async () => {
  const store = createNoteStore([
    makeNote("note-1", "user-1", { title: "Titre original" }),
  ]);
  const result = await updateMyPersonalNoteCore(
    "user-2",
    "note-1",
    validInput({ title: "Titre pirate" }),
    store.dependencies,
  );

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "PERSONAL_NOTE_NOT_FOUND");
  }
  assert.equal(store.notes[0].title, "Titre original");
});

test("updating an unknown note id returns the same not-found result as a foreign note", async () => {
  const store = createNoteStore([makeNote("note-1", "user-1")]);

  const foreignResult = await updateMyPersonalNoteCore(
    "user-2",
    "note-1",
    validInput(),
    store.dependencies,
  );
  const unknownResult = await updateMyPersonalNoteCore(
    "user-1",
    "missing-note",
    validInput(),
    store.dependencies,
  );

  assert.deepEqual(foreignResult, unknownResult);
});

test("owner can delete their own note", async () => {
  const store = createNoteStore([makeNote("note-1", "user-1")]);
  const result = await deleteMyPersonalNoteCore(
    "user-1",
    "note-1",
    store.dependencies,
  );

  assert.equal(result.success, true);
  assert.equal(store.notes.length, 0);
});

test("a foreign user cannot delete someone else's note", async () => {
  const store = createNoteStore([makeNote("note-1", "user-1")]);
  const result = await deleteMyPersonalNoteCore(
    "user-2",
    "note-1",
    store.dependencies,
  );

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "PERSONAL_NOTE_NOT_FOUND");
  }
  assert.equal(store.notes.length, 1);
});

test("deleting an unknown note id returns the same not-found result as a foreign note", async () => {
  const store = createNoteStore([makeNote("note-1", "user-1")]);

  const foreignResult = await deleteMyPersonalNoteCore(
    "user-2",
    "note-1",
    store.dependencies,
  );
  const unknownResult = await deleteMyPersonalNoteCore(
    "user-1",
    "missing-note",
    store.dependencies,
  );

  assert.deepEqual(foreignResult, unknownResult);
});

test("deleting one note does not affect another user's notes", async () => {
  const store = createNoteStore([
    makeNote("note-1", "user-1"),
    makeNote("note-2", "user-2"),
  ]);

  await deleteMyPersonalNoteCore("user-1", "note-1", store.dependencies);

  assert.deepEqual(
    store.notes.map((note) => note.id),
    ["note-2"],
  );
});

function createNoteStore(initialNotes: StoredNote[] = []) {
  const notes = initialNotes.map((note) => ({ ...note }));
  let nextId = notes.length + 1;

  const dependencies: PersonalNoteServiceDependencies = {
    list: async (userId) =>
      notes.filter((note) => note.userId === userId).map(toRow),
    findForOwner: async (userId, noteId) => {
      const note = notes.find(
        (item) => item.id === noteId && item.userId === userId,
      );
      return note ? toRow(note) : null;
    },
    create: async (userId, data) => {
      const note = makeNote(`note-${nextId++}`, userId, data);
      notes.push(note);
      return { id: note.id };
    },
    updateForOwner: async (userId, noteId, data) => {
      const note = notes.find(
        (item) => item.id === noteId && item.userId === userId,
      );
      if (!note) {
        return 0;
      }
      Object.assign(note, data, { updatedAt: new Date() });
      return 1;
    },
    deleteForOwner: async (userId, noteId) => {
      const index = notes.findIndex(
        (item) => item.id === noteId && item.userId === userId,
      );
      if (index === -1) {
        return 0;
      }
      notes.splice(index, 1);
      return 1;
    },
  };

  return { notes, dependencies };
}

function makeNote(
  id: string,
  userId: string,
  overrides: Partial<StoredNote> = {},
): StoredNote {
  return {
    id,
    userId,
    category: "URGENT_TODO",
    title: "Note",
    content: null,
    pinned: false,
    createdAt: new Date("2026-08-01T12:00:00.000Z"),
    updatedAt: new Date("2026-08-01T12:00:00.000Z"),
    ...overrides,
  };
}

function toRow(note: StoredNote): PersonalNoteRow {
  return {
    id: note.id,
    category: note.category,
    title: note.title,
    content: note.content,
    pinned: note.pinned,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}
