import assert from "node:assert/strict";
import test from "node:test";

import {
  personalNoteSchema,
  personalNoteUpdateSchema,
} from "./personal-note.schema";

function validInput() {
  return {
    category: "URGENT_TODO",
    title: "Relancer l’école Sainte-Marie",
    content: "Appeler avant vendredi.",
    pinned: false,
  };
}

test("accepts a valid note", () => {
  const result = personalNoteSchema.safeParse(validInput());

  assert.equal(result.success, true);
});

test("requires a category", () => {
  const result = personalNoteSchema.safeParse({
    ...validInput(),
    category: "",
  });

  assert.equal(result.success, false);
});

test("rejects an invalid category", () => {
  const result = personalNoteSchema.safeParse({
    ...validInput(),
    category: "NOT_A_CATEGORY",
  });

  assert.equal(result.success, false);
});

test("requires a title", () => {
  const result = personalNoteSchema.safeParse({
    ...validInput(),
    title: "",
  });

  assert.equal(result.success, false);
});

test("rejects a title shorter than 2 characters", () => {
  const result = personalNoteSchema.safeParse({
    ...validInput(),
    title: "A",
  });

  assert.equal(result.success, false);
});

test("rejects a title longer than 180 characters", () => {
  const result = personalNoteSchema.safeParse({
    ...validInput(),
    title: "A".repeat(181),
  });

  assert.equal(result.success, false);
});

test("normalizes blank or whitespace-only content to undefined", () => {
  const blank = personalNoteSchema.parse({ ...validInput(), content: "" });
  const whitespace = personalNoteSchema.parse({
    ...validInput(),
    content: "   ",
  });
  const omitted = personalNoteSchema.parse({
    ...validInput(),
    content: undefined,
  });

  assert.equal(blank.content, undefined);
  assert.equal(whitespace.content, undefined);
  assert.equal(omitted.content, undefined);
});

test("rejects content longer than 10,000 characters", () => {
  const result = personalNoteSchema.safeParse({
    ...validInput(),
    content: "A".repeat(10001),
  });

  assert.equal(result.success, false);
});

test("defaults pinned to false", () => {
  const result = personalNoteSchema.parse({
    ...validInput(),
    pinned: undefined,
  });

  assert.equal(result.pinned, false);
});

test("has no userId field to abuse — ownership never comes from the browser", () => {
  assert.deepEqual(Object.keys(personalNoteSchema.shape).sort(), [
    "category",
    "content",
    "pinned",
    "title",
  ]);

  const result = personalNoteSchema.safeParse({
    ...validInput(),
    userId: "some-other-user",
  });

  assert.equal(result.success, true);
  assert.equal("userId" in (result.success ? result.data : {}), false);
});

test("personalNoteUpdateSchema requires a noteId but still has no userId field", () => {
  assert.deepEqual(Object.keys(personalNoteUpdateSchema.shape).sort(), [
    "category",
    "content",
    "noteId",
    "pinned",
    "title",
  ]);

  const missingNoteId = personalNoteUpdateSchema.safeParse(validInput());
  const withNoteId = personalNoteUpdateSchema.safeParse({
    ...validInput(),
    noteId: "note-1",
  });

  assert.equal(missingNoteId.success, false);
  assert.equal(withNoteId.success, true);
});
