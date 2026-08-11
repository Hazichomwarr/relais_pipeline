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

test("a COMMERCIAL viewing a foreign prospect gets the product's shared read-only route when a foreignHref is supplied (Ticket 15G.2)", () => {
  const href = resolveGenericProductDetailHref(
    { id: "commercial-1", role: "COMMERCIAL" },
    { id: "prospect-1", assignedUserId: "commercial-2" },
    { foreignHref: (id) => `/products/digital-services/${id}` },
  );

  assert.equal(href, "/products/digital-services/prospect-1");
});

test("ADMIN/MANAGER ignore foreignHref entirely — they always get the admin route", () => {
  const href = resolveGenericProductDetailHref(
    { id: "admin-1", role: "ADMIN" },
    { id: "prospect-1", assignedUserId: "someone-else" },
    { foreignHref: (id) => `/products/digital-services/${id}` },
  );

  assert.equal(href, "/admin/prospects/prospect-1");
});

test("an owning COMMERCIAL ignores foreignHref entirely — they always get their editable route", () => {
  const href = resolveGenericProductDetailHref(
    { id: "commercial-1", role: "COMMERCIAL" },
    { id: "prospect-1", assignedUserId: "commercial-1" },
    { foreignHref: (id) => `/products/digital-services/${id}` },
  );

  assert.equal(href, "/dashboard/commercial/prospects/prospect-1");
});

test("omitting foreignHref preserves the pre-15G.2 behavior (LOKARI/NIA) — no link for a foreign prospect", () => {
  const href = resolveGenericProductDetailHref(
    { id: "commercial-1", role: "COMMERCIAL" },
    { id: "prospect-1", assignedUserId: "commercial-2" },
  );

  assert.equal(href, null);
});
