import assert from "node:assert/strict";
import test from "node:test";

import { prospectSchema } from "./prospect.schema";

function validInput() {
  return {
    product: "KARMDA",
    name: "École Horizon",
    prospectType: "École privée",
    contactName: "Mme Ouédraogo",
    phone: "70 12 34 56",
    location: "Ouagadougou",
    interest: "INTERESTED",
    status: "NEW",
    onlinePresence: "NONE",
    nextAction: "CALL_BACK",
    followUpDate: "2026-08-10",
    notes: "Le prospect a demandé une démonstration.",
    schoolType: "PRIVATE_PRIMARY",
  };
}

test("accepts a fully filled submission", () => {
  const result = prospectSchema.safeParse(validInput());

  assert.equal(result.success, true);
});

test("Ticket 25H.1 §3: rejects creating a prospect directly with status WON — the follow-up workflow is the only authoritative WON transition boundary", () => {
  const result = prospectSchema.safeParse({ ...validInput(), status: "WON" });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(
      result.error.flatten().fieldErrors.status?.length,
      "expected a validation error on the status field",
    );
  }
});

test("every other status remains a valid initial value at creation", () => {
  for (const status of [
    "NEW",
    "TO_FOLLOW_UP",
    "CONTACTED",
    "QUALIFIED",
    "PROPOSAL_SENT",
    "LOST",
  ]) {
    const result = prospectSchema.safeParse({ ...validInput(), status });
    assert.equal(result.success, true, `expected status "${status}" to be accepted`);
  }
});

test("treats an unselected 'Présence en ligne' as no submission, not an error", () => {
  const result = prospectSchema.safeParse({
    ...validInput(),
    onlinePresence: "",
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.onlinePresence, undefined);
  }
});

test("treats an unselected 'Prochaine action' as no submission, not an error", () => {
  const result = prospectSchema.safeParse({
    ...validInput(),
    nextAction: "",
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.nextAction, undefined);
  }
});

test("accepts a report with both optional selects left blank", () => {
  const result = prospectSchema.safeParse({
    ...validInput(),
    onlinePresence: "",
    nextAction: "",
    followUpDate: "",
  });

  assert.equal(result.success, true);
});

test("rejects a genuinely invalid onlinePresence value", () => {
  const result = prospectSchema.safeParse({
    ...validInput(),
    onlinePresence: "NOT_A_REAL_OPTION",
  });

  assert.equal(result.success, false);
});

test("rejects a genuinely invalid nextAction value", () => {
  const result = prospectSchema.safeParse({
    ...validInput(),
    nextAction: "NOT_A_REAL_OPTION",
  });

  assert.equal(result.success, false);
});

test("requires the product-specific field for the selected product", () => {
  const result = prospectSchema.safeParse({
    ...validInput(),
    schoolType: "",
  });

  assert.equal(result.success, false);
});
