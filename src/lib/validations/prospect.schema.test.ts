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
    assignedUserId: "user-1",
    schoolType: "PRIVATE_PRIMARY",
  };
}

test("accepts a fully filled submission", () => {
  const result = prospectSchema.safeParse(validInput());

  assert.equal(result.success, true);
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

test("requires the assigned commercial", () => {
  const result = prospectSchema.safeParse({
    ...validInput(),
    assignedUserId: "",
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
