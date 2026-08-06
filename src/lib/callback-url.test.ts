import assert from "node:assert/strict";
import test from "node:test";

import { resolveSafeCallbackUrl, resolveSafeReturnTo } from "./callback-url";

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

test("resolveSafeReturnTo preserves a safe internal path with query string", () => {
  assert.equal(
    resolveSafeReturnTo("/admin?userId=123&status=QUALIFIED", "/admin"),
    "/admin?userId=123&status=QUALIFIED",
  );
});

test("resolveSafeReturnTo falls back to the caller's own fallback, not /dashboard", () => {
  assert.equal(
    resolveSafeReturnTo(null, "/dashboard/commercial"),
    "/dashboard/commercial",
  );
  assert.equal(
    resolveSafeReturnTo(undefined, "/dashboard/commercial"),
    "/dashboard/commercial",
  );
  assert.equal(
    resolveSafeReturnTo("", "/dashboard/commercial"),
    "/dashboard/commercial",
  );
});

test("resolveSafeReturnTo rejects an absolute external URL", () => {
  assert.equal(
    resolveSafeReturnTo("https://malicious.example", "/admin"),
    "/admin",
  );
});

test("resolveSafeReturnTo rejects a protocol-relative URL", () => {
  assert.equal(
    resolveSafeReturnTo("//malicious.example", "/admin"),
    "/admin",
  );
});

test("resolveSafeReturnTo rejects a javascript-scheme URL", () => {
  assert.equal(
    resolveSafeReturnTo("javascript:alert(1)", "/admin"),
    "/admin",
  );
});
