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
    agentName: "Aminata",
    interest: "READY_TO_DISCUSS",
    status: "QUALIFIED",
    nextAction: "SEND_DEMO",
    followUpDate: "2026-08-05",
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

test("normalizes empty optional values", () => {
  const result = prospectActivitySchema.parse({
    ...validInput(),
    details: "  ",
    agentName: "",
    interest: "",
    status: "",
    nextAction: "",
    followUpDate: "",
  });

  assert.equal(result.details, undefined);
  assert.equal(result.agentName, undefined);
  assert.equal(result.interest, undefined);
  assert.equal(result.status, undefined);
  assert.equal(result.nextAction, undefined);
  assert.equal(result.followUpDate, undefined);
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
