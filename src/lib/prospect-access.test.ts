import assert from "node:assert/strict";
import test from "node:test";
import type { RelaisProduct, UserRole } from "@prisma/client";

import { resolveProspectAccess, resolveReadOnlyProductHref } from "./prospect-access";

const products: RelaisProduct[] = ["KARMDA", "DIGITAL_SERVICES", "LOKARI", "NIA"];

const readOnlyRouteByProduct: Record<RelaisProduct, string> = {
  KARMDA: "/schools/prospect-1",
  DIGITAL_SERVICES: "/products/digital-services/prospect-1",
  LOKARI: "/products/lokari/prospect-1",
  NIA: "/products/nia/prospect-1",
};

// ---------------------------------------------------------------------------
// Ticket 28C §88 — exhaustive matrix: every role × every product
// ---------------------------------------------------------------------------

for (const product of products) {
  test(`ADMIN always gets MANAGEMENT access for ${product}, regardless of ownership`, () => {
    const access = resolveProspectAccess(
      { id: "admin-1", role: "ADMIN" },
      { id: "prospect-1", product, assignedUserId: "someone-else" },
    );
    assert.deepEqual(access, {
      kind: "MANAGEMENT",
      detailHref: "/admin/prospects/prospect-1",
      canOperate: true,
      canReassign: true,
    });
  });

  test(`MANAGER always gets MANAGEMENT access for ${product}, regardless of ownership`, () => {
    const access = resolveProspectAccess(
      { id: "manager-1", role: "MANAGER" },
      { id: "prospect-1", product, assignedUserId: null },
    );
    assert.deepEqual(access, {
      kind: "MANAGEMENT",
      detailHref: "/admin/prospects/prospect-1",
      canOperate: true,
      canReassign: true,
    });
  });

  test(`an owning COMMERCIAL gets OWNER access for ${product}`, () => {
    const access = resolveProspectAccess(
      { id: "commercial-1", role: "COMMERCIAL" },
      { id: "prospect-1", product, assignedUserId: "commercial-1" },
    );
    assert.deepEqual(access, {
      kind: "OWNER",
      detailHref: "/dashboard/commercial/prospects/prospect-1",
      canOperate: true,
      canReassign: false,
    });
  });

  test(`a non-owning COMMERCIAL gets READ_ONLY access for ${product}, at the product's safe summary route — never null`, () => {
    const access = resolveProspectAccess(
      { id: "commercial-1", role: "COMMERCIAL" },
      { id: "prospect-1", product, assignedUserId: "commercial-2" },
    );
    assert.deepEqual(access, {
      kind: "READ_ONLY",
      detailHref: readOnlyRouteByProduct[product],
      canOperate: false,
      canReassign: false,
    });
  });

  test(`a COMMERCIAL viewing an unassigned ${product} prospect gets READ_ONLY, not OWNER`, () => {
    const access = resolveProspectAccess(
      { id: "commercial-1", role: "COMMERCIAL" },
      { id: "prospect-1", product, assignedUserId: null },
    );
    assert.equal(access.kind, "READ_ONLY");
  });

  test(`ASSISTANT gets NONE for ${product}, regardless of ownership`, () => {
    const access = resolveProspectAccess(
      { id: "assistant-1", role: "ASSISTANT" as UserRole },
      { id: "prospect-1", product, assignedUserId: "assistant-1" },
    );
    assert.deepEqual(access, {
      kind: "NONE",
      detailHref: null,
      canOperate: false,
      canReassign: false,
    });
  });
}

// ---------------------------------------------------------------------------
// resolveReadOnlyProductHref — the per-product route mapper in isolation
// ---------------------------------------------------------------------------

test("resolveReadOnlyProductHref maps every product to its distinct summary route", () => {
  assert.equal(resolveReadOnlyProductHref("KARMDA", "prospect-1"), "/schools/prospect-1");
  assert.equal(
    resolveReadOnlyProductHref("DIGITAL_SERVICES", "prospect-1"),
    "/products/digital-services/prospect-1",
  );
  assert.equal(resolveReadOnlyProductHref("LOKARI", "prospect-1"), "/products/lokari/prospect-1");
  assert.equal(resolveReadOnlyProductHref("NIA", "prospect-1"), "/products/nia/prospect-1");
});

// ---------------------------------------------------------------------------
// canReassign / canOperate semantics — the mutation-authority distinction
// (28C §42: a route existing is not permission to mutate; this only
// asserts the presentation-policy flags this file itself computes)
// ---------------------------------------------------------------------------

test("only MANAGEMENT carries canReassign: true — OWNER, READ_ONLY, and NONE never do", () => {
  const management = resolveProspectAccess(
    { id: "admin-1", role: "ADMIN" },
    { id: "p", product: "KARMDA", assignedUserId: null },
  );
  const owner = resolveProspectAccess(
    { id: "c-1", role: "COMMERCIAL" },
    { id: "p", product: "KARMDA", assignedUserId: "c-1" },
  );
  const readOnly = resolveProspectAccess(
    { id: "c-1", role: "COMMERCIAL" },
    { id: "p", product: "KARMDA", assignedUserId: "c-2" },
  );
  const none = resolveProspectAccess(
    { id: "a-1", role: "ASSISTANT" as UserRole },
    { id: "p", product: "KARMDA", assignedUserId: null },
  );

  assert.equal(management.canReassign, true);
  assert.equal(owner.canReassign, false);
  assert.equal(readOnly.canReassign, false);
  assert.equal(none.canReassign, false);
});

test("MANAGEMENT and OWNER both carry canOperate: true; READ_ONLY and NONE never do", () => {
  const management = resolveProspectAccess(
    { id: "admin-1", role: "ADMIN" },
    { id: "p", product: "NIA", assignedUserId: null },
  );
  const owner = resolveProspectAccess(
    { id: "c-1", role: "COMMERCIAL" },
    { id: "p", product: "NIA", assignedUserId: "c-1" },
  );
  const readOnly = resolveProspectAccess(
    { id: "c-1", role: "COMMERCIAL" },
    { id: "p", product: "NIA", assignedUserId: "c-2" },
  );

  assert.equal(management.canOperate, true);
  assert.equal(owner.canOperate, true);
  assert.equal(readOnly.canOperate, false);
});
