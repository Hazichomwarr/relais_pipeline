import assert from "node:assert/strict";
import test from "node:test";

import { loginSchema, newPasswordSchema } from "./auth.schema";

test("accepts a valid email and password", () => {
  const result = loginSchema.safeParse({
    email: "awa@relais.test",
    password: "secret123",
  });

  assert.equal(result.success, true);
});

test("rejects a missing email with a friendly French message", () => {
  const result = loginSchema.safeParse({ email: "", password: "secret123" });

  assert.equal(result.success, false);
  assert.match(
    result.success ? "" : result.error.flatten().fieldErrors.email?.[0] ?? "",
    /requise/,
  );
});

test("rejects a malformed email with a friendly French message", () => {
  const result = loginSchema.safeParse({
    email: "not-an-email",
    password: "secret123",
  });

  assert.equal(result.success, false);
  assert.match(
    result.success ? "" : result.error.flatten().fieldErrors.email?.[0] ?? "",
    /valide/,
  );
});

test("rejects a missing password with a friendly French message", () => {
  const result = loginSchema.safeParse({
    email: "awa@relais.test",
    password: "",
  });

  assert.equal(result.success, false);
  assert.match(
    result.success
      ? ""
      : result.error.flatten().fieldErrors.password?.[0] ?? "",
    /requis/,
  );
});

test("new password schema enforces a minimum length", () => {
  const tooShort = newPasswordSchema.safeParse({ password: "short" });
  const longEnough = newPasswordSchema.safeParse({ password: "long-enough" });

  assert.equal(tooShort.success, false);
  assert.equal(longEnough.success, true);
});
