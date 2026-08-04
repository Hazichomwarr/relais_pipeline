import assert from "node:assert/strict";
import test from "node:test";

import { resolveSafeCallbackUrl } from "./callback-url";

test("missing callback resolves to /dashboard", () => {
  assert.equal(resolveSafeCallbackUrl(null), "/dashboard");
  assert.equal(resolveSafeCallbackUrl(undefined), "/dashboard");
});

test("empty callback resolves to /dashboard", () => {
  assert.equal(resolveSafeCallbackUrl(""), "/dashboard");
});

test("internal admin callback is preserved", () => {
  assert.equal(resolveSafeCallbackUrl("/admin/users"), "/admin/users");
});

test("internal commercial callback is preserved", () => {
  assert.equal(
    resolveSafeCallbackUrl("/dashboard/commercial/profile"),
    "/dashboard/commercial/profile",
  );
});

test("absolute external URL is rejected", () => {
  assert.equal(resolveSafeCallbackUrl("https://example.com"), "/dashboard");
});

test("protocol-relative external URL is rejected", () => {
  assert.equal(resolveSafeCallbackUrl("//example.com"), "/dashboard");
});

test("javascript-scheme URL is rejected", () => {
  assert.equal(
    resolveSafeCallbackUrl("javascript:alert(1)"),
    "/dashboard",
  );
});
