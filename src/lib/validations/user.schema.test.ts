import assert from "node:assert/strict";
import test from "node:test";

import { userSchema } from "./user.schema";

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
