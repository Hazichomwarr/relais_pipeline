import assert from "node:assert/strict";
import test from "node:test";

import { appendReturnTo, buildReturnToPath } from "./return-to";

test("buildReturnToPath returns the bare pathname with no params", () => {
  assert.equal(buildReturnToPath("/admin", {}), "/admin");
});

test("buildReturnToPath omits undefined and empty values", () => {
  assert.equal(
    buildReturnToPath("/admin", { search: undefined, status: "" }),
    "/admin",
  );
});

test("buildReturnToPath serializes present values into a query string", () => {
  const path = buildReturnToPath("/admin", {
    userId: "123",
    status: "QUALIFIED",
  });

  assert.equal(path, "/admin?userId=123&status=QUALIFIED");
});

test("appendReturnTo encodes a returnTo value that has its own query string", () => {
  const path = appendReturnTo(
    "/admin/prospects/abc",
    "/admin?userId=123&status=QUALIFIED",
  );

  assert.equal(
    path,
    "/admin/prospects/abc?returnTo=%2Fadmin%3FuserId%3D123%26status%3DQUALIFIED",
  );
});

test("appendReturnTo round-trips back to the original value via URLSearchParams", () => {
  const returnTo = "/dashboard/commercial?search=%C3%A9cole";
  const path = appendReturnTo("/dashboard/commercial/prospects/xyz", returnTo);

  const [, query] = path.split("?");
  const decoded = new URLSearchParams(query).get("returnTo");

  assert.equal(decoded, returnTo);
});
