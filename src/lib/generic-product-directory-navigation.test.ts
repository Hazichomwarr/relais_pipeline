import assert from "node:assert/strict";
import test from "node:test";

import { resolveGenericProductDetailHref } from "./generic-product-directory-navigation";

test("ADMIN always gets the admin detail route, regardless of ownership", () => {
  const href = resolveGenericProductDetailHref(
    { id: "admin-1", role: "ADMIN" },
    { id: "prospect-1", assignedUserId: "someone-else" },
  );

  assert.equal(href, "/admin/prospects/prospect-1");
});

test("MANAGER always gets the admin detail route, regardless of ownership", () => {
  const href = resolveGenericProductDetailHref(
    { id: "manager-1", role: "MANAGER" },
    { id: "prospect-1", assignedUserId: null },
  );

  assert.equal(href, "/admin/prospects/prospect-1");
});

test("a COMMERCIAL viewing their own prospect gets the commercial detail route", () => {
  const href = resolveGenericProductDetailHref(
    { id: "commercial-1", role: "COMMERCIAL" },
    { id: "prospect-1", assignedUserId: "commercial-1" },
  );

  assert.equal(href, "/dashboard/commercial/prospects/prospect-1");
});

test("a COMMERCIAL viewing another commercial's prospect gets no link — no foreign editable permission is granted", () => {
  const href = resolveGenericProductDetailHref(
    { id: "commercial-1", role: "COMMERCIAL" },
    { id: "prospect-1", assignedUserId: "commercial-2" },
  );

  assert.equal(href, null);
});

test("a COMMERCIAL viewing an unassigned prospect gets no link", () => {
  const href = resolveGenericProductDetailHref(
    { id: "commercial-1", role: "COMMERCIAL" },
    { id: "prospect-1", assignedUserId: null },
  );

  assert.equal(href, null);
});
