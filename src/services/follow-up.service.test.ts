import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFollowUpQueueWhere,
  presentFollowUpQueueItem,
} from "./follow-up.service-core";

const today = new Date("2026-08-03T12:00:00");

test("builds the queue filters inside Prisma with terminal-status exclusion", () => {
  const where = buildFollowUpQueueWhere(
    {
      userId: "user-1",
      product: "KARMDA",
      interest: "READY_TO_DISCUSS",
      nextAction: "SEND_DEMO",
    },
    today,
  );

  assert.deepEqual(where, {
    AND: [
      { status: { notIn: ["WON", "LOST"] } },
      {
        OR: [
          { followUpDate: { lt: new Date("2026-08-04T00:00:00") } },
          { status: "TO_FOLLOW_UP" },
        ],
      },
      { assignedUserId: "user-1" },
      { product: "KARMDA" },
      { interest: "READY_TO_DISCUSS" },
      { nextAction: "SEND_DEMO" },
    ],
  });
});

test("presents assigned user, latest activity, and overdue data", () => {
  const item = presentFollowUpQueueItem(
    makeRow({
      assignedUser: {
        id: "user-1",
        firstName: "Awa",
        lastName: "Traoré",
        active: false,
      },
      activities: [{ occurredAt: new Date("2026-08-02T15:00:00") }],
    }),
    today,
  );

  assert.equal(item.commercialName, "Awa Traoré");
  assert.equal(item.latestActivityAt?.getTime(), new Date("2026-08-02T15:00:00").getTime());
  assert.equal(item.overdueDays, 2);
  assert.equal(item.followUpLabel, "En retard de 2 jours");
});

test("falls back to the historical agent name for an unresolved prospect", () => {
  const item = presentFollowUpQueueItem(makeRow(), today);

  assert.equal(item.commercialName, "Nom historique");
});

test("scopes a commercial follow-up queue inside the Prisma query", () => {
  const where = buildFollowUpQueueWhere({ userId: "commercial-1" }, today);
  assert.deepEqual((where.AND as object[]).at(-1), {
    assignedUserId: "commercial-1",
  });
});

function makeRow(
  overrides: Partial<Parameters<typeof presentFollowUpQueueItem>[0]> = {},
): Parameters<typeof presentFollowUpQueueItem>[0] {
  return {
    id: "prospect-1",
    name: "École Exemple",
    prospectType: "École privée",
    product: "KARMDA",
    phone: "+22670000000",
    interest: "INTERESTED",
    nextAction: "CALL_BACK",
    followUpDate: new Date("2026-08-01T10:00:00"),
    createdAt: new Date("2026-07-30T10:00:00"),
    agentName: "Nom historique",
    assignedUser: null,
    activities: [],
    ...overrides,
  };
}
