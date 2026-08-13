import assert from "node:assert/strict";
import test from "node:test";

import {
  cancelProspectActionSchema,
  completeProspectActionSchema,
  createProspectActionSchema,
} from "./prospect-action.schema";

function validCreateInput(overrides: Record<string, unknown> = {}) {
  return {
    prospectId: "prospect-1",
    assignedToUserId: "user-1",
    title: "Faire une démonstration",
    description: "Le directeur est disponible après 14h.",
    dueAt: "2026-08-14T10:00",
    ...overrides,
  };
}

test("accepts a valid creation input and normalizes dueAt to a Date", () => {
  const result = createProspectActionSchema.safeParse(validCreateInput());

  assert.equal(result.success, true);
  if (result.success) {
    assert.ok(result.data.dueAt instanceof Date);
    assert.equal(result.data.title, "Faire une démonstration");
  }
});

test("rejects a missing or whitespace-only title", () => {
  assert.equal(
    createProspectActionSchema.safeParse(validCreateInput({ title: "" })).success,
    false,
  );
  assert.equal(
    createProspectActionSchema.safeParse(validCreateInput({ title: "  " }))
      .success,
    false,
  );
});

test("rejects a missing assignee", () => {
  assert.equal(
    createProspectActionSchema.safeParse(
      validCreateInput({ assignedToUserId: "" }),
    ).success,
    false,
  );
});

test("rejects a missing or invalid due date", () => {
  assert.equal(
    createProspectActionSchema.safeParse(validCreateInput({ dueAt: undefined }))
      .success,
    false,
  );
  assert.equal(
    createProspectActionSchema.safeParse(validCreateInput({ dueAt: "not-a-date" }))
      .success,
    false,
  );
});

test("normalizes a blank description to undefined", () => {
  const result = createProspectActionSchema.safeParse(
    validCreateInput({ description: "   " }),
  );

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.description, undefined);
  }
});

test("description is optional", () => {
  const result = createProspectActionSchema.safeParse(
    validCreateInput({ description: undefined }),
  );

  assert.equal(result.success, true);
});

test("never surfaces trusted lifecycle/identity fields even if a client submits them", () => {
  const result = createProspectActionSchema.safeParse(
    validCreateInput({
      status: "COMPLETED",
      createdByUserId: "someone-else",
      completedByUserId: "someone-else",
      completedAt: new Date(),
      canceledByUserId: "someone-else",
      canceledAt: new Date(),
    }),
  );

  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(Object.keys(result.data).sort(), [
      "assignedToUserId",
      "description",
      "dueAt",
      "prospectId",
      "title",
    ]);
  }
});

test("completeProspectActionSchema requires only an actionId", () => {
  assert.equal(
    completeProspectActionSchema.safeParse({ actionId: "action-1" }).success,
    true,
  );
  assert.equal(completeProspectActionSchema.safeParse({}).success, false);
});

test("completeProspectActionSchema never surfaces a client-supplied completedByUserId", () => {
  const result = completeProspectActionSchema.safeParse({
    actionId: "action-1",
    completedByUserId: "someone-else",
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(Object.keys(result.data), ["actionId"]);
  }
});

test("cancelProspectActionSchema requires a meaningful cancellation reason", () => {
  assert.equal(
    cancelProspectActionSchema.safeParse({
      actionId: "action-1",
      cancellationReason: "Reporté",
    }).success,
    true,
  );
  assert.equal(
    cancelProspectActionSchema.safeParse({
      actionId: "action-1",
      cancellationReason: "ok",
    }).success,
    false,
  );
  assert.equal(
    cancelProspectActionSchema.safeParse({ actionId: "action-1" }).success,
    false,
  );
});

test("cancelProspectActionSchema never surfaces a client-supplied canceledByUserId", () => {
  const result = cancelProspectActionSchema.safeParse({
    actionId: "action-1",
    cancellationReason: "Le client a reporté le rendez-vous.",
    canceledByUserId: "someone-else",
    status: "CANCELED",
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(Object.keys(result.data).sort(), [
      "actionId",
      "cancellationReason",
    ]);
  }
});
