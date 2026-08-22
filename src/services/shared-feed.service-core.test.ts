import assert from "node:assert/strict";
import test from "node:test";

import {
  buildInteractionPreview,
  compareSharedFeedItems,
  getSharedFeedCore,
  mapFollowUpCompletedRow,
  mapProspectInteractionRow,
  mapProspectWonRow,
  mapUserStatusRow,
  mergeSharedFeedItems,
  resolveSharedFeedLimit,
  type ProspectActivityFeedRow,
  type SharedFeedDependencies,
  type SharedFeedItem,
  type UserStatusActivityFeedRow,
} from "./shared-feed.service-core";

function activityRow(
  overrides: Partial<ProspectActivityFeedRow> = {},
): ProspectActivityFeedRow {
  return {
    id: "activity-1",
    type: "PHONE_CALL",
    summary: "Appel avec le directeur",
    details: "Le directeur souhaite une démonstration mardi.",
    occurredAt: new Date("2026-08-08T09:00:00.000Z"),
    agentName: "Julbert Serme",
    prospect: {
      id: "prospect-1",
      name: "Lycée Saint Viateur",
      product: "KARMDA",
      assignedUserId: "commercial-1",
    },
    ...overrides,
  };
}

function userStatusRow(
  overrides: Partial<UserStatusActivityFeedRow> = {},
): UserStatusActivityFeedRow {
  return {
    id: "status-1",
    type: "ACTIVATED",
    occurredAt: new Date("2026-08-08T09:00:00.000Z"),
    user: { firstName: "Odette", lastName: "Kaboré", role: "COMMERCIAL" },
    actorUser: { firstName: "Awa", lastName: "Bazié" },
    ...overrides,
  };
}

// --- resolveSharedFeedLimit ---------------------------------------------

test("resolveSharedFeedLimit defaults to 30 when no limit is given", () => {
  assert.equal(resolveSharedFeedLimit(undefined), 30);
});

test("resolveSharedFeedLimit caps at the hard maximum of 100", () => {
  assert.equal(resolveSharedFeedLimit(500), 100);
});

test("resolveSharedFeedLimit floors below 1 up to 1", () => {
  assert.equal(resolveSharedFeedLimit(0), 1);
  assert.equal(resolveSharedFeedLimit(-5), 1);
});

test("resolveSharedFeedLimit truncates a fractional limit", () => {
  assert.equal(resolveSharedFeedLimit(12.7), 12);
});

// --- buildInteractionPreview --------------------------------------------

test("buildInteractionPreview returns null for missing or blank details", () => {
  assert.equal(buildInteractionPreview(null), null);
  assert.equal(buildInteractionPreview(undefined), null);
  assert.equal(buildInteractionPreview("   "), null);
});

test("buildInteractionPreview preserves short details verbatim", () => {
  assert.equal(
    buildInteractionPreview("Le directeur souhaite une démonstration mardi."),
    "Le directeur souhaite une démonstration mardi.",
  );
});

test("buildInteractionPreview truncates long details with an ellipsis, never rewriting the content", () => {
  const details = "x".repeat(400);
  const preview = buildInteractionPreview(details);

  assert.ok(preview);
  assert.ok(preview!.length <= 321);
  assert.ok(preview!.startsWith("x".repeat(320)));
  assert.ok(preview!.endsWith("…"));
});

// --- mapping --------------------------------------------------------------

test("mapProspectInteractionRow preserves actor, prospect, activity type, occurredAt, and a safe navigation target", () => {
  const item = mapProspectInteractionRow(activityRow());

  assert.deepEqual(item, {
    id: "activity-1",
    type: "PROSPECT_INTERACTION",
    occurredAt: "2026-08-08T09:00:00.000Z",
    actorName: "Julbert Serme",
    prospectId: "prospect-1",
    prospectName: "Lycée Saint Viateur",
    prospectProduct: "KARMDA",
    prospectAssignedUserId: "commercial-1",
    activityType: "PHONE_CALL",
    summary: "Appel avec le directeur",
    preview: "Le directeur souhaite une démonstration mardi.",
    entity: { kind: "PROSPECT", id: "prospect-1" },
  });
});

test("mapProspectInteractionRow falls back to a null actor when agentName was never captured", () => {
  const item = mapProspectInteractionRow(activityRow({ agentName: null }));
  assert.equal(item.actorName, null);
});

test("mapFollowUpCompletedRow maps a FOLLOW_UP activity into a completed follow-up item", () => {
  const item = mapFollowUpCompletedRow(
    activityRow({
      id: "activity-2",
      type: "FOLLOW_UP",
      summary: "Relance effectuée",
      agentName: "Odette",
    }),
  );

  assert.equal(item.type, "FOLLOW_UP_COMPLETED");
  assert.equal(item.actorName, "Odette");
  assert.equal(item.prospectName, "Lycée Saint Viateur");
  assert.equal(item.summary, "Relance effectuée");
});

test("every prospect-related mapper carries product and assignedUserId for role-safe link resolution (Ticket 18B)", () => {
  const foreignRow = activityRow({
    prospect: {
      id: "prospect-2",
      name: "Boutique Alimentation Koudougou",
      product: "DIGITAL_SERVICES",
      assignedUserId: "commercial-7",
    },
  });

  assert.equal(mapProspectInteractionRow(foreignRow).prospectProduct, "DIGITAL_SERVICES");
  assert.equal(mapProspectInteractionRow(foreignRow).prospectAssignedUserId, "commercial-7");
  assert.equal(
    mapFollowUpCompletedRow(foreignRow).prospectAssignedUserId,
    "commercial-7",
  );
  assert.equal(mapProspectWonRow(foreignRow).prospectProduct, "DIGITAL_SERVICES");
});

test("mapProspectWonRow maps a WON_TRANSITION activity, preserving actor and timestamp when known", () => {
  const item = mapProspectWonRow(
    activityRow({
      id: "activity-3",
      type: "WON_TRANSITION",
      summary: "Le prospect est devenu client (statut WON).",
      agentName: "Julbert Serme",
      occurredAt: new Date("2026-08-08T10:15:00.000Z"),
      prospect: {
        id: "prospect-9",
        name: "Groupe Scolaire Wend-Panga",
        product: "KARMDA",
        assignedUserId: null,
      },
    }),
  );

  assert.deepEqual(item, {
    id: "activity-3",
    type: "PROSPECT_WON",
    occurredAt: "2026-08-08T10:15:00.000Z",
    actorName: "Julbert Serme",
    prospectId: "prospect-9",
    prospectName: "Groupe Scolaire Wend-Panga",
    prospectProduct: "KARMDA",
    prospectAssignedUserId: null,
    entity: { kind: "PROSPECT", id: "prospect-9" },
  });
});

test("mapProspectWonRow allows a null actor rather than fabricating one when it was never captured", () => {
  const item = mapProspectWonRow(activityRow({ type: "WON_TRANSITION", agentName: null }));
  assert.equal(item.actorName, null);
});

test("mapUserStatusRow maps ACTIVATED and DEACTIVATED, carrying the role label and actor", () => {
  const activated = mapUserStatusRow(userStatusRow({ type: "ACTIVATED" }));
  const deactivated = mapUserStatusRow(
    userStatusRow({
      id: "status-2",
      type: "DEACTIVATED",
      user: { firstName: "Salifou", lastName: "Ouédraogo", role: "COMMERCIAL" },
      actorUser: { firstName: "Awa", lastName: "Bazié" },
    }),
  );

  assert.equal(activated.type, "USER_ACTIVATED");
  assert.equal(activated.userDisplayName, "Odette Kaboré");
  assert.equal(activated.userRole, "COMMERCIAL");
  assert.equal(activated.actorName, "Awa Bazié");

  assert.equal(deactivated.type, "USER_DEACTIVATED");
  assert.equal(deactivated.userDisplayName, "Salifou Ouédraogo");
});

// --- ordering ---------------------------------------------------------------

test("compareSharedFeedItems orders newest occurredAt first", () => {
  const older = mapProspectWonRow(activityRow({ id: "a", occurredAt: new Date("2026-08-01T00:00:00.000Z") }));
  const newer = mapProspectWonRow(activityRow({ id: "b", occurredAt: new Date("2026-08-05T00:00:00.000Z") }));

  assert.ok(compareSharedFeedItems(newer, older) < 0);
  assert.ok(compareSharedFeedItems(older, newer) > 0);
});

test("compareSharedFeedItems falls back to id DESC for identical timestamps, deterministically", () => {
  const occurredAt = new Date("2026-08-08T09:00:00.000Z");
  const itemA = mapProspectWonRow(activityRow({ id: "activity-a", occurredAt }));
  const itemB = mapProspectWonRow(activityRow({ id: "activity-b", occurredAt }));

  const sorted = [itemA, itemB].sort(compareSharedFeedItems);
  assert.deepEqual(sorted.map((item) => item.id), ["activity-b", "activity-a"]);
});

test("mergeSharedFeedItems interleaves every family by occurredAt and respects the limit", () => {
  const interaction = mapProspectInteractionRow(
    activityRow({ id: "interaction-1", occurredAt: new Date("2026-08-08T12:00:00.000Z") }),
  );
  const followUp = mapFollowUpCompletedRow(
    activityRow({ id: "followup-1", type: "FOLLOW_UP", occurredAt: new Date("2026-08-08T11:00:00.000Z") }),
  );
  const won = mapProspectWonRow(
    activityRow({ id: "won-1", type: "WON_TRANSITION", occurredAt: new Date("2026-08-08T10:00:00.000Z") }),
  );
  const userStatus = mapUserStatusRow(
    userStatusRow({ id: "status-1", occurredAt: new Date("2026-08-08T09:00:00.000Z") }),
  );

  const merged = mergeSharedFeedItems([[interaction], [followUp], [won], [userStatus]], 3);

  assert.deepEqual(
    merged.map((item) => item.id),
    ["interaction-1", "followup-1", "won-1"],
  );
});

// --- getSharedFeedCore: bounded, deterministic composition ------------------

test("getSharedFeedCore fetches all four sources bounded by the resolved limit and merges them deterministically", async () => {
  const requestedLimits: number[] = [];

  const dependencies: SharedFeedDependencies = {
    findRecentProspectInteractions: async (limit) => {
      requestedLimits.push(limit);
      return [activityRow({ id: "interaction-1", occurredAt: new Date("2026-08-08T08:00:00.000Z") })];
    },
    findRecentFollowUpsCompleted: async (limit) => {
      requestedLimits.push(limit);
      return [
        activityRow({
          id: "followup-1",
          type: "FOLLOW_UP",
          occurredAt: new Date("2026-08-08T09:00:00.000Z"),
        }),
      ];
    },
    findRecentProspectWonEvents: async (limit) => {
      requestedLimits.push(limit);
      return [
        activityRow({
          id: "won-1",
          type: "WON_TRANSITION",
          occurredAt: new Date("2026-08-08T10:00:00.000Z"),
        }),
      ];
    },
    findRecentUserStatusEvents: async (limit) => {
      requestedLimits.push(limit);
      return [userStatusRow({ id: "status-1", occurredAt: new Date("2026-08-08T07:00:00.000Z") })];
    },
  };

  const feed = await getSharedFeedCore({ limit: 2 }, dependencies);

  assert.deepEqual(requestedLimits, [2, 2, 2, 2]);
  assert.deepEqual(
    feed.map((item) => item.id),
    ["won-1", "followup-1"],
  );
});

test("getSharedFeedCore returns items typed only as one of the four approved families", async () => {
  const dependencies: SharedFeedDependencies = {
    findRecentProspectInteractions: async () => [activityRow()],
    findRecentFollowUpsCompleted: async () => [activityRow({ type: "FOLLOW_UP" })],
    findRecentProspectWonEvents: async () => [activityRow({ type: "WON_TRANSITION" })],
    findRecentUserStatusEvents: async () => [userStatusRow()],
  };

  const feed = await getSharedFeedCore({}, dependencies);
  const allowedTypes: SharedFeedItem["type"][] = [
    "PROSPECT_INTERACTION",
    "FOLLOW_UP_COMPLETED",
    "PROSPECT_WON",
    "USER_ACTIVATED",
    "USER_DEACTIVATED",
  ];

  for (const item of feed) {
    assert.ok(allowedTypes.includes(item.type));
  }
});

test("INTERNAL_NOTE never enters the normalized feed even when it is the newest row inside the limit", async () => {
  const privateSentinel = "PRIVATE_INTERNAL_NOTE_SHOULD_NEVER_LEAVE_PROSPECT";
  const dependencies: SharedFeedDependencies = {
    findRecentProspectInteractions: async () => [
      activityRow({
        id: "private-internal-note",
        type: "INTERNAL_NOTE",
        summary: privateSentinel,
        details: privateSentinel,
        occurredAt: new Date("2026-08-08T15:00:00.000Z"),
      }),
      activityRow({
        id: "phone-call",
        type: "PHONE_CALL",
        occurredAt: new Date("2026-08-08T12:00:00.000Z"),
      }),
      activityRow({
        id: "meeting",
        type: "MEETING",
        occurredAt: new Date("2026-08-08T11:00:00.000Z"),
      }),
      activityRow({
        id: "demo",
        type: "DEMO",
        occurredAt: new Date("2026-08-08T10:00:00.000Z"),
      }),
    ],
    findRecentFollowUpsCompleted: async () => [],
    findRecentProspectWonEvents: async () => [],
    findRecentUserStatusEvents: async () => [],
  };

  const feed = await getSharedFeedCore({ limit: 4 }, dependencies);

  assert.deepEqual(
    feed.map((item) => item.id),
    ["phone-call", "meeting", "demo"],
  );
  assert.deepEqual(
    feed
      .filter((item) => item.type === "PROSPECT_INTERACTION")
      .map((item) => item.activityType),
    ["PHONE_CALL", "MEETING", "DEMO"],
  );
  assert.doesNotMatch(JSON.stringify(feed), /private-internal-note/);
  assert.doesNotMatch(JSON.stringify(feed), new RegExp(privateSentinel));
});
