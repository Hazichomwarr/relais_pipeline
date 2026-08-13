import assert from "node:assert/strict";
import test from "node:test";
import type { ProspectActionRow } from "@/src/services/prospect-action.service-core";

import {
  compareProspectActionQueueItems,
  filterProspectActionQueueByBucket,
  formatProspectActionQueueDueLabel,
  getProspectActionQueueBucket,
  resolveEffectiveAssignee,
  resolveProspectActionQueueProspectHref,
  summarizeProspectActionQueue,
  toProspectActionQueueItem,
  toProspectWithoutOpenActionItem,
  type ProspectActionQueueFilters,
  type ProspectActionQueueRow,
} from "./prospect-action-queue.service-core";

// Business timezone offset is 0 (Africa/Ouagadougou == UTC), so "2026-08-13
// 00:00 business time" is simply this UTC instant.
const NOW = new Date("2026-08-13T10:00:00.000Z");

function actionRow(overrides: Partial<ProspectActionRow> = {}): ProspectActionRow {
  return {
    id: "action-1",
    prospectId: "prospect-1",
    assignedToUserId: "assignee-1",
    createdByUserId: "creator-1",
    status: "OPEN",
    title: "Appeler le directeur",
    description: null,
    dueAt: new Date("2026-08-13T09:00:00.000Z"),
    completedAt: null,
    completedByUserId: null,
    canceledAt: null,
    canceledByUserId: null,
    cancellationReason: null,
    createdAt: new Date("2026-08-10T09:00:00.000Z"),
    updatedAt: new Date("2026-08-10T09:00:00.000Z"),
    ...overrides,
  };
}

function queueRow(overrides: Partial<ProspectActionQueueRow> = {}): ProspectActionQueueRow {
  return {
    ...actionRow(),
    prospect: {
      id: "prospect-1",
      name: "École Horizon",
      product: "KARMDA",
      status: "QUALIFIED",
      assignedUserId: "owner-1",
    },
    assignedToUser: {
      id: "assignee-1",
      firstName: "Mamadou",
      lastName: "Nana",
      active: true,
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Bucket boundaries — exact instants from the ticket
// ---------------------------------------------------------------------------

test("bucket boundary: 2026-08-12 23:59:59 is OVERDUE", () => {
  assert.equal(
    getProspectActionQueueBucket(new Date("2026-08-12T23:59:59.000Z"), NOW),
    "OVERDUE",
  );
});

test("bucket boundary: 2026-08-13 00:00:00 is TODAY", () => {
  assert.equal(
    getProspectActionQueueBucket(new Date("2026-08-13T00:00:00.000Z"), NOW),
    "TODAY",
  );
});

test("bucket boundary: 2026-08-13 23:59:59 is TODAY", () => {
  assert.equal(
    getProspectActionQueueBucket(new Date("2026-08-13T23:59:59.000Z"), NOW),
    "TODAY",
  );
});

test("bucket boundary: 2026-08-14 00:00:00 is UPCOMING", () => {
  assert.equal(
    getProspectActionQueueBucket(new Date("2026-08-14T00:00:00.000Z"), NOW),
    "UPCOMING",
  );
});

test("bucket derivation does not depend on the developer machine's local timezone (fixed UTC instants only)", () => {
  const originalTz = process.env.TZ;
  process.env.TZ = "America/Los_Angeles";
  try {
    assert.equal(
      getProspectActionQueueBucket(new Date("2026-08-13T00:00:00.000Z"), NOW),
      "TODAY",
    );
  } finally {
    process.env.TZ = originalTz;
  }
});

// ---------------------------------------------------------------------------
// Due label
// ---------------------------------------------------------------------------

test("due label: today", () => {
  assert.equal(
    formatProspectActionQueueDueLabel(new Date("2026-08-13T14:00:00.000Z"), NOW),
    "Aujourd’hui",
  );
});

test("due label: overdue by exactly one and several days", () => {
  assert.equal(
    formatProspectActionQueueDueLabel(new Date("2026-08-12T15:00:00.000Z"), NOW),
    "En retard de 1 jour",
  );
  assert.equal(
    formatProspectActionQueueDueLabel(new Date("2026-08-10T15:00:00.000Z"), NOW),
    "En retard de 3 jours",
  );
});

test("due label: tomorrow", () => {
  assert.equal(
    formatProspectActionQueueDueLabel(new Date("2026-08-14T09:00:00.000Z"), NOW),
    "Demain",
  );
});

test("due label: further out falls back to a formatted date", () => {
  const label = formatProspectActionQueueDueLabel(
    new Date("2026-08-20T09:00:00.000Z"),
    NOW,
  );
  assert.doesNotMatch(label, /Aujourd|Demain|retard/);
});

// ---------------------------------------------------------------------------
// Terminal actions never in scope (this whole module assumes OPEN-only —
// the actual WHERE clause lives in the service, this locks the ordering/
// bucket helpers don't accidentally special-case status)
// ---------------------------------------------------------------------------

test("ordering reuses Ticket 20B's compareProspectActionsForListing unchanged", () => {
  const soon = actionRow({ id: "soon", dueAt: new Date("2026-08-13T09:00:00.000Z") });
  const later = actionRow({ id: "later", dueAt: new Date("2026-08-13T15:00:00.000Z") });

  const sorted = [later, soon].sort(compareProspectActionQueueItems);
  assert.deepEqual(sorted.map((item) => item.id), ["soon", "later"]);
});

test("a single dueAt-ascending sort already produces correct per-bucket order with no separate bucket rank", () => {
  const overdueOld = actionRow({ id: "overdue-old", dueAt: new Date("2026-08-05T09:00:00.000Z") });
  const overdueRecent = actionRow({ id: "overdue-recent", dueAt: new Date("2026-08-12T09:00:00.000Z") });
  const todayEarly = actionRow({ id: "today-early", dueAt: new Date("2026-08-13T09:00:00.000Z") });
  const todayLate = actionRow({ id: "today-late", dueAt: new Date("2026-08-13T15:00:00.000Z") });
  const tomorrow = actionRow({ id: "tomorrow", dueAt: new Date("2026-08-14T09:00:00.000Z") });
  const nextWeek = actionRow({ id: "next-week", dueAt: new Date("2026-08-20T09:00:00.000Z") });

  const sorted = [nextWeek, todayLate, tomorrow, overdueRecent, todayEarly, overdueOld].sort(
    compareProspectActionQueueItems,
  );

  assert.deepEqual(sorted.map((item) => item.id), [
    "overdue-old",
    "overdue-recent",
    "today-early",
    "today-late",
    "tomorrow",
    "next-week",
  ]);
});

// ---------------------------------------------------------------------------
// Scope / assignee resolution
// ---------------------------------------------------------------------------

test("MINE scope always resolves to the actor's own id, ignoring any assignee param", () => {
  const filters: ProspectActionQueueFilters = {
    scope: "MINE",
    bucket: "ALL",
    assignedToUserId: "someone-else",
  };
  assert.equal(resolveEffectiveAssignee({ id: "actor-1" }, filters), "actor-1");
});

test("ALL scope uses the assignee filter as-is, including when the assignee owns nothing", () => {
  const filters: ProspectActionQueueFilters = {
    scope: "ALL",
    bucket: "ALL",
    assignedToUserId: "user-5",
  };
  assert.equal(resolveEffectiveAssignee({ id: "actor-1" }, filters), "user-5");
});

test("ALL scope with no assignee filter resolves to undefined (no filter applied)", () => {
  const filters: ProspectActionQueueFilters = { scope: "ALL", bucket: "ALL" };
  assert.equal(resolveEffectiveAssignee({ id: "actor-1" }, filters), undefined);
});

// ---------------------------------------------------------------------------
// Summary + bucket filtering derived from one bounded result set
// ---------------------------------------------------------------------------

test("summarizeProspectActionQueue counts every bucket plus the total, from one pass over the rows", () => {
  const rows = [
    actionRow({ id: "a", dueAt: new Date("2026-08-10T09:00:00.000Z") }), // overdue
    actionRow({ id: "b", dueAt: new Date("2026-08-12T09:00:00.000Z") }), // overdue
    actionRow({ id: "c", dueAt: new Date("2026-08-13T09:00:00.000Z") }), // today
    actionRow({ id: "d", dueAt: new Date("2026-08-14T09:00:00.000Z") }), // upcoming
    actionRow({ id: "e", dueAt: new Date("2026-08-20T09:00:00.000Z") }), // upcoming
  ];

  assert.deepEqual(summarizeProspectActionQueue(rows, NOW), {
    overdue: 2,
    today: 1,
    upcoming: 2,
    totalOpen: 5,
  });
});

test("filterProspectActionQueueByBucket narrows to the requested bucket, or returns everything for ALL", () => {
  const rows = [
    actionRow({ id: "overdue", dueAt: new Date("2026-08-10T09:00:00.000Z") }),
    actionRow({ id: "today", dueAt: new Date("2026-08-13T09:00:00.000Z") }),
    actionRow({ id: "upcoming", dueAt: new Date("2026-08-14T09:00:00.000Z") }),
  ];

  assert.deepEqual(
    filterProspectActionQueueByBucket(rows, "TODAY", NOW).map((r) => r.id),
    ["today"],
  );
  assert.deepEqual(
    filterProspectActionQueueByBucket(rows, "ALL", NOW).map((r) => r.id),
    ["overdue", "today", "upcoming"],
  );
});

// ---------------------------------------------------------------------------
// Role-safe navigation — reuses the Product Directory resolvers
// ---------------------------------------------------------------------------

test("ADMIN/MANAGER always get the full admin detail route, for every product", () => {
  for (const role of ["ADMIN", "MANAGER"] as const) {
    for (const product of ["KARMDA", "LOKARI", "NIA", "DIGITAL_SERVICES"] as const) {
      assert.equal(
        resolveProspectActionQueueProspectHref(
          { id: "admin-1", role },
          { id: "prospect-1", product, assignedUserId: "someone" },
        ),
        "/admin/prospects/prospect-1",
      );
    }
  }
});

test("a COMMERCIAL owning the prospect always gets their editable detail route, for every product", () => {
  for (const product of ["KARMDA", "LOKARI", "NIA", "DIGITAL_SERVICES"] as const) {
    assert.equal(
      resolveProspectActionQueueProspectHref(
        { id: "commercial-1", role: "COMMERCIAL" },
        { id: "prospect-1", product, assignedUserId: "commercial-1" },
      ),
      "/dashboard/commercial/prospects/prospect-1",
    );
  }
});

test("a COMMERCIAL viewing a foreign KARMDA prospect gets the shared school route", () => {
  assert.equal(
    resolveProspectActionQueueProspectHref(
      { id: "commercial-1", role: "COMMERCIAL" },
      { id: "prospect-1", product: "KARMDA", assignedUserId: "someone-else" },
    ),
    "/schools/prospect-1",
  );
});

test("a COMMERCIAL viewing a foreign DIGITAL_SERVICES prospect gets the shared directory route", () => {
  assert.equal(
    resolveProspectActionQueueProspectHref(
      { id: "commercial-1", role: "COMMERCIAL" },
      { id: "prospect-1", product: "DIGITAL_SERVICES", assignedUserId: "someone-else" },
    ),
    "/products/digital-services/prospect-1",
  );
});

for (const product of ["LOKARI", "NIA"] as const) {
  test(`a COMMERCIAL viewing a foreign ${product} prospect gets no link — no shared read-only route exists, and none is fabricated`, () => {
    assert.equal(
      resolveProspectActionQueueProspectHref(
        { id: "commercial-1", role: "COMMERCIAL" },
        { id: "prospect-1", product, assignedUserId: "someone-else" },
      ),
      null,
    );
  });
}

// ---------------------------------------------------------------------------
// Queue item DTO
// ---------------------------------------------------------------------------

test("toProspectActionQueueItem derives bucket, href, and completion permissions consistently", () => {
  const viewer = { id: "assignee-1", role: "COMMERCIAL" as const };
  const item = toProspectActionQueueItem(
    viewer,
    queueRow({ prospect: { ...queueRow().prospect, assignedUserId: "assignee-1" } }),
    NOW,
  );

  assert.equal(item.bucket, "TODAY");
  assert.equal(item.prospectHref, "/dashboard/commercial/prospects/prospect-1");
  assert.equal(item.canComplete, true, "the assignee may complete their own action");
  assert.equal(item.canCancel, true, "the assignee may also cancel their own action");
  assert.equal(item.assignedTo.name, "Mamadou Nana");
  assert.equal(item.assignedTo.active, true);
});

test("toProspectActionQueueItem: a delegated assignee who does not own the prospect gets the prospect's shared read-only route, not an edit route (Ticket 20B delegation model)", () => {
  const viewer = { id: "assignee-1", role: "COMMERCIAL" as const };
  const item = toProspectActionQueueItem(
    viewer,
    queueRow(), // prospect.assignedUserId defaults to "owner-1" — a different person than the task assignee
    NOW,
  );

  assert.equal(item.prospectHref, "/schools/prospect-1");
  assert.equal(
    item.canComplete,
    true,
    "delegated assignee can still complete their own task despite not owning the prospect",
  );
});

test("toProspectActionQueueItem marks an unrelated COMMERCIAL as unable to complete or cancel", () => {
  const viewer = { id: "bystander", role: "COMMERCIAL" as const };
  const item = toProspectActionQueueItem(viewer, queueRow(), NOW);

  assert.equal(item.canComplete, false);
  assert.equal(item.canCancel, false);
});

test("toProspectActionQueueItem never drops an inactive assignee's action — it stays visible with active:false", () => {
  const viewer = { id: "admin-1", role: "ADMIN" as const };
  const item = toProspectActionQueueItem(
    viewer,
    queueRow({
      assignedToUser: {
        id: "assignee-1",
        firstName: "Mamadou",
        lastName: "Nana",
        active: false,
      },
    }),
    NOW,
  );

  assert.equal(item.assignedTo.active, false);
  assert.equal(item.id, "action-1");
});

test("toProspectActionQueueItem never includes description/note-length CRM internals beyond the compact DTO shape", () => {
  const viewer = { id: "admin-1", role: "ADMIN" as const };
  const item = toProspectActionQueueItem(viewer, queueRow(), NOW);

  assert.deepEqual(Object.keys(item).sort(), [
    "assignedTo",
    "bucket",
    "canCancel",
    "canComplete",
    "createdAt",
    "description",
    "dueAt",
    "id",
    "prospect",
    "prospectHref",
    "title",
  ]);
  assert.deepEqual(Object.keys(item.prospect).sort(), ["id", "name", "product", "status"]);
});

// ---------------------------------------------------------------------------
// Crack detection DTO
// ---------------------------------------------------------------------------

test("toProspectWithoutOpenActionItem resolves the same role-safe href as the queue item", () => {
  const viewer = { id: "admin-1", role: "ADMIN" as const };
  const item = toProspectWithoutOpenActionItem(viewer, {
    id: "prospect-2",
    name: "Entreprise Wend-Kuni",
    product: "DIGITAL_SERVICES",
    status: "CONTACTED",
    interest: "INTERESTED",
    assignedUserId: "someone",
  });

  assert.equal(item.href, "/admin/prospects/prospect-2");
  assert.equal(item.interest, "INTERESTED");
});
