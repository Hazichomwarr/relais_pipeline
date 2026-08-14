import assert from "node:assert/strict";
import test from "node:test";

import { prospectActivitySchema } from "./prospect-activity.schema";

function validInput() {
  return {
    prospectId: "prospect-1",
    type: "PHONE_CALL",
    summary: "Appel avec le directeur",
    details: "Une démonstration est demandée.",
    occurredAt: "2026-08-03T10:30",
  };
}

test("requires a prospect id", () => {
  const result = prospectActivitySchema.safeParse({
    ...validInput(),
    prospectId: "",
  });

  assert.equal(result.success, false);
});

test("requires an activity type", () => {
  const result = prospectActivitySchema.safeParse({
    ...validInput(),
    type: "",
  });

  assert.equal(result.success, false);
});

test("requires a concise summary", () => {
  const missing = prospectActivitySchema.safeParse({
    ...validInput(),
    summary: "",
  });
  const tooLong = prospectActivitySchema.safeParse({
    ...validInput(),
    summary: "a".repeat(201),
  });

  assert.equal(missing.success, false);
  assert.equal(tooLong.success, false);
});

test("normalizes empty optional details", () => {
  const result = prospectActivitySchema.parse({
    ...validInput(),
    details: "  ",
  });

  assert.equal(result.details, undefined);
});

test("accepts valid optional details and occurred date-time", () => {
  const result = prospectActivitySchema.parse(validInput());

  assert.equal(result.details, "Une démonstration est demandée.");
  assert.ok(result.occurredAt instanceof Date);
  assert.equal(Number.isNaN(result.occurredAt.getTime()), false);
});

test("rejects an invalid occurred date", () => {
  const result = prospectActivitySchema.safeParse({
    ...validInput(),
    occurredAt: "not-a-date",
  });

  assert.equal(result.success, false);
});

test("rejects an interaction unreasonably far in the future", () => {
  const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const result = prospectActivitySchema.safeParse({
    ...validInput(),
    occurredAt: futureDate,
  });

  assert.equal(result.success, false);
});

test("rejects an unknown activity enum value", () => {
  const result = prospectActivitySchema.safeParse({
    ...validInput(),
    type: "EMAIL",
  });

  assert.equal(result.success, false);
});

// Ticket 22B — FOLLOW_UP is the structured follow-up workflow's exclusive
// checkpoint type; the generic interaction path must never be able to
// create one. See prospect-follow-up.schema.ts for the authoritative path.
test("rejects FOLLOW_UP as a generic interaction type", () => {
  const result = prospectActivitySchema.safeParse({
    ...validInput(),
    type: "FOLLOW_UP",
  });

  assert.equal(result.success, false);
});

// Ticket 22B — commercial-state mutation and free-text actor attribution
// were removed from this schema entirely. Submitting them is harmless
// (zod silently drops unrecognized keys) precisely because the schema no
// longer defines fields for them — there is nothing left to validate or
// forward to the service layer.
test("ignores legacy commercial-state and actor fields if still submitted", () => {
  const result = prospectActivitySchema.parse({
    ...validInput(),
    agentName: "Aminata",
    interest: "READY_TO_DISCUSS",
    status: "QUALIFIED",
    nextAction: "SEND_DEMO",
    followUpDate: "2026-08-05",
  });

  assert.deepEqual(Object.keys(result).sort(), [
    "details",
    "occurredAt",
    "prospectId",
    "summary",
    "type",
  ]);
});
