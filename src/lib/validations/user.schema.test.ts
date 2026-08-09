import assert from "node:assert/strict";
import test from "node:test";

import { commercialProfileUpdateSchema, userSchema } from "./user.schema";

function validInput() {
  return {
    firstName: "Aminata",
    lastName: "Ouédraogo",
    email: "AMINATA@EXAMPLE.COM ",
    phone: "70 12 34 56",
    role: "COMMERCIAL",
    active: true,
  };
}

test("requires first and last names", () => {
  const missingFirstName = userSchema.safeParse({
    ...validInput(),
    firstName: "",
  });
  const missingLastName = userSchema.safeParse({
    ...validInput(),
    lastName: "",
  });

  assert.equal(missingFirstName.success, false);
  assert.equal(missingLastName.success, false);
});

test("rejects an invalid optional email", () => {
  const result = userSchema.safeParse({
    ...validInput(),
    email: "not-an-email",
  });

  assert.equal(result.success, false);
});

test("normalizes optional email and phone", () => {
  const populated = userSchema.parse(validInput());
  const empty = userSchema.parse({
    ...validInput(),
    email: "",
    phone: "  ",
  });

  assert.equal(populated.email, "aminata@example.com");
  assert.equal(populated.phone, "70 12 34 56");
  assert.equal(empty.email, null);
  assert.equal(empty.phone, null);
});

test("accepts an omitted phone", () => {
  const result = userSchema.safeParse({
    ...validInput(),
    phone: "",
  });

  assert.equal(result.success, true);
});

test("validates the user role enum", () => {
  const invalid = userSchema.safeParse({
    ...validInput(),
    role: "OWNER",
  });
  const valid = userSchema.safeParse({
    ...validInput(),
    role: "MANAGER",
  });

  assert.equal(invalid.success, false);
  assert.equal(valid.success, true);
});

test("defaults new users to active", () => {
  const result = userSchema.parse({ ...validInput(), active: undefined });

  assert.equal(result.active, true);
});

test("dailyReportTemplateType defaults to null when omitted (not every user submits daily reports)", () => {
  const result = userSchema.parse(validInput());

  assert.equal(result.dailyReportTemplateType, null);
});

test("dailyReportTemplateType accepts an empty string as 'no template' and normalizes it to null", () => {
  const result = userSchema.parse({
    ...validInput(),
    dailyReportTemplateType: "",
  });

  assert.equal(result.dailyReportTemplateType, null);
});

test("dailyReportTemplateType accepts ASSISTANT and OPERATIONS_COORDINATOR", () => {
  const assistant = userSchema.safeParse({
    ...validInput(),
    dailyReportTemplateType: "ASSISTANT",
  });
  const coordinator = userSchema.safeParse({
    ...validInput(),
    dailyReportTemplateType: "OPERATIONS_COORDINATOR",
  });

  assert.equal(assistant.success, true);
  assert.equal(coordinator.success, true);
});

test("dailyReportTemplateType rejects a value outside the known V1 templates", () => {
  const result = userSchema.safeParse({
    ...validInput(),
    dailyReportTemplateType: "SALES_MANAGER",
  });

  assert.equal(result.success, false);
});

test("commercialProfileUpdateSchema accepts first name, last name, and phone", () => {
  const result = commercialProfileUpdateSchema.safeParse({
    firstName: "Aminata",
    lastName: "Ouédraogo",
    phone: "70 12 34 56",
  });

  assert.equal(result.success, true);
});

test("commercialProfileUpdateSchema has no email/role/active fields to abuse", () => {
  assert.deepEqual(
    Object.keys(commercialProfileUpdateSchema.shape).sort(),
    ["firstName", "lastName", "phone"],
  );
});

test("commercialProfileUpdateSchema silently drops extra keys like role or email", () => {
  const result = commercialProfileUpdateSchema.safeParse({
    firstName: "Aminata",
    lastName: "Ouédraogo",
    phone: "",
    role: "ADMIN",
    email: "attacker@example.com",
    active: false,
  });

  assert.equal(result.success, true);
  assert.equal("role" in (result.success ? result.data : {}), false);
  assert.equal("email" in (result.success ? result.data : {}), false);
  assert.equal("active" in (result.success ? result.data : {}), false);
});
