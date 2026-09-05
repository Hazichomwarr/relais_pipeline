import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSchoolDirectoryWhere,
  presentSchoolDirectoryItem,
  schoolDirectoryOrderBy,
  type SchoolDirectoryRow,
} from "./school-directory.service-core";

function baseRow(overrides: Partial<SchoolDirectoryRow> = {}): SchoolDirectoryRow {
  return {
    id: "prospect-1",
    name: "École Karpala",
    status: "NEW",
    interest: "MAYBE",
    agentName: "Fallback Agent",
    assignedUserId: null,
    assignedUser: null,
    activities: [],
    ...overrides,
  };
}

test("only schools are returned — no accidental caller scoping", () => {
  const where = buildSchoolDirectoryWhere({});

  assert.deepEqual(where, { product: "KARMDA" });
  assert.equal("assignedUserId" in where, false);
  assert.equal("userId" in where, false);
});

test("search finds schools by name", () => {
  const where = buildSchoolDirectoryWhere({ search: "Karpala" });

  assert.deepEqual(where, {
    product: "KARMDA",
    name: { contains: "Karpala", mode: "insensitive" },
  });
});

test("partial search trims whitespace and never touches contact/phone/location", () => {
  const where = buildSchoolDirectoryWhere({ search: "  École  " });

  assert.deepEqual(where.name, { contains: "École", mode: "insensitive" });
  assert.equal("contactName" in where, false);
  assert.equal("phone" in where, false);
  assert.equal("location" in where, false);
  assert.equal("OR" in where, false);
});

test("blank search does not add a name filter", () => {
  const where = buildSchoolDirectoryWhere({ search: "   " });

  assert.deepEqual(where, { product: "KARMDA" });
});

test("ordering is deterministic and alphabetical by name", () => {
  assert.deepEqual(schoolDirectoryOrderBy, [{ name: "asc" }]);
});

test("presentation falls back to the agentName snapshot when unassigned", () => {
  const item = presentSchoolDirectoryItem(baseRow());

  assert.equal(item.commercialName, "Fallback Agent");
});

test("presentation prefers the live assigned user's name", () => {
  const item = presentSchoolDirectoryItem(
    baseRow({
      assignedUserId: "user-1",
      assignedUser: {
        firstName: "Aïcha",
        lastName: "Sawadogo",
        role: "COMMERCIAL",
        active: true,
      },
    }),
  );

  assert.equal(item.commercialName, "Aïcha Sawadogo");
});

// ---------------------------------------------------------------------------
// Ticket 28C — the truthful "responsible" representation, distinct from
// commercialName's agentName fallback
// ---------------------------------------------------------------------------

test("responsible is unassigned (never falling back to agentName) for a genuinely unassigned school", () => {
  const item = presentSchoolDirectoryItem(baseRow());

  assert.deepEqual(item.responsible, { assigned: false });
  assert.equal(item.commercialName, "Fallback Agent", "commercialName's fallback is untouched");
});

test("responsible reflects the live assigned user's name, role, and active state", () => {
  const item = presentSchoolDirectoryItem(
    baseRow({
      assignedUserId: "user-1",
      assignedUser: {
        firstName: "Aïcha",
        lastName: "Sawadogo",
        role: "MANAGER",
        active: false,
      },
    }),
  );

  assert.deepEqual(item.responsible, {
    assigned: true,
    userId: "user-1",
    name: "Aïcha Sawadogo",
    role: "MANAGER",
    active: false,
  });
});

test("presentation reports no last activity when none were logged", () => {
  const item = presentSchoolDirectoryItem(baseRow({ activities: [] }));

  assert.equal(item.lastActivityAt, null);
});

test("presentation surfaces the most recent activity date", () => {
  const occurredAt = new Date("2026-08-01T10:00:00.000Z");
  const item = presentSchoolDirectoryItem(
    baseRow({ activities: [{ occurredAt }] }),
  );

  assert.equal(item.lastActivityAt, occurredAt);
});
