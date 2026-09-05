import assert from "node:assert/strict";
import test from "node:test";
import type { UserRole } from "@prisma/client";

import {
  buildWonTransitionActivityData,
  isWonTransition,
  resolveWonCredit,
  type WonCreditSnapshot,
  type WonCreditSource,
} from "./prospect-won-transition.service-core";

const NO_CREDIT: WonCreditSnapshot = {
  creditedUserId: null,
  creditedUserNameAtEvent: null,
  creditedUserRoleAtEvent: null,
};

test("isWonTransition is true only when the prospect crosses from a non-WON status into WON", () => {
  assert.equal(isWonTransition("QUALIFIED", "WON"), true);
  assert.equal(isWonTransition("NEW", "WON"), true);
});

test("isWonTransition is false when the prospect is already WON", () => {
  assert.equal(isWonTransition("WON", "WON"), false);
});

test("isWonTransition is false when the status change isn't a move to WON", () => {
  assert.equal(isWonTransition("QUALIFIED", "PROPOSAL_SENT"), false);
  assert.equal(isWonTransition("WON", "LOST"), false);
});

test("isWonTransition is false when no status change is submitted at all", () => {
  assert.equal(isWonTransition("QUALIFIED", undefined), false);
});

// ---------------------------------------------------------------------------
// resolveWonCredit (Ticket 25H.1) — the credited employee follows
// authoritative prospect ownership, never the actor, with no fallback.
// ---------------------------------------------------------------------------

function ownedBy(
  id: string,
  firstName: string,
  lastName: string,
  role: UserRole,
): WonCreditSource {
  return { assignedUserId: id, assignedUser: { firstName, lastName, role } };
}

for (const role of ["COMMERCIAL", "MANAGER", "ADMIN"] as const) {
  test(`resolveWonCredit credits the prospect's assigned owner regardless of their role (${role})`, () => {
    const credit = resolveWonCredit(ownedBy("owner-1", "Fatou", "Zongo", role));

    assert.equal(credit.creditedUserId, "owner-1");
    assert.equal(credit.creditedUserNameAtEvent, "Fatou Zongo");
    assert.equal(credit.creditedUserRoleAtEvent, role);
  });
}

test("resolveWonCredit represents an unassigned prospect as no credited user — never a fabricated fallback", () => {
  const credit = resolveWonCredit({ assignedUserId: null, assignedUser: null });

  assert.deepEqual(credit, NO_CREDIT);
});

test("resolveWonCredit is defensive against an assignedUserId with no matching assignedUser payload — still no credited user, not a crash", () => {
  const credit = resolveWonCredit({ assignedUserId: "owner-1", assignedUser: null });

  assert.deepEqual(credit, NO_CREDIT);
});

test("resolveWonCredit takes no actor parameter at all — it is structurally impossible for it to credit the closing actor instead of the owner", () => {
  assert.equal(resolveWonCredit.length, 1);
});

// ---------------------------------------------------------------------------
// buildWonTransitionActivityData
// ---------------------------------------------------------------------------

test("buildWonTransitionActivityData produces a system-generated activity, never inventing an actor", () => {
  const occurredAt = new Date("2026-08-08T09:00:00.000Z");
  const data = buildWonTransitionActivityData({
    prospectId: "prospect-1",
    occurredAt,
    credit: NO_CREDIT,
  });

  assert.deepEqual(data, {
    prospectId: "prospect-1",
    type: "WON_TRANSITION",
    summary: "Le prospect est devenu client (statut WON).",
    occurredAt,
    agentName: undefined,
    creditedUserId: null,
    creditedUserNameAtEvent: null,
    creditedUserRoleAtEvent: null,
    responsibleUserIdAtEvent: null,
  });
});

test("buildWonTransitionActivityData preserves the acting commercial's name when known", () => {
  const data = buildWonTransitionActivityData({
    prospectId: "prospect-1",
    occurredAt: new Date("2026-08-08T09:00:00.000Z"),
    agentName: "Julbert Serme",
    credit: NO_CREDIT,
  });

  assert.equal(data.agentName, "Julbert Serme");
});

test("Ticket 25H.1 §18 — the core bug 25G uncovered: a MANAGER or ADMIN closing a COMMERCIAL's prospect must not become the credited party", () => {
  const credit = resolveWonCredit(ownedBy("commercial-a", "Aminata", "Traoré", "COMMERCIAL"));
  const data = buildWonTransitionActivityData({
    prospectId: "prospect-1",
    occurredAt: new Date("2026-08-08T09:00:00.000Z"),
    agentName: "Amidou Sawadogo", // the MANAGER who submitted the closing follow-up
    credit,
  });

  assert.equal(data.agentName, "Amidou Sawadogo");
  assert.equal(data.creditedUserId, "commercial-a");
  assert.equal(data.creditedUserNameAtEvent, "Aminata Traoré");
  assert.equal(data.creditedUserRoleAtEvent, "COMMERCIAL");
  assert.notEqual(data.creditedUserNameAtEvent, data.agentName);
});

test("Ticket 25H.1 §19 — a COMMERCIAL closing their own prospect: actor and credited employee are the same person, without conflating the two concepts", () => {
  const credit = resolveWonCredit(ownedBy("commercial-a", "Aminata", "Traoré", "COMMERCIAL"));
  const data = buildWonTransitionActivityData({
    prospectId: "prospect-1",
    occurredAt: new Date("2026-08-08T09:00:00.000Z"),
    agentName: "Aminata Traoré",
    credit,
  });

  assert.equal(data.agentName, "Aminata Traoré");
  assert.equal(data.creditedUserId, "commercial-a");
  assert.equal(data.creditedUserNameAtEvent, data.agentName);
});

// ---------------------------------------------------------------------------
// Ticket 28A.1 §11 — for a WON event, responsibleUserIdAtEvent and
// creditedUserId are the same underlying fact, resolved from the same
// in-transaction Prospect read, never independently re-derived.
// ---------------------------------------------------------------------------

test("buildWonTransitionActivityData sets responsibleUserIdAtEvent equal to creditedUserId — never independently derived, never the acting ADMIN/MANAGER", () => {
  const credit = resolveWonCredit(ownedBy("commercial-a", "Aminata", "Traoré", "COMMERCIAL"));
  const data = buildWonTransitionActivityData({
    prospectId: "prospect-1",
    occurredAt: new Date("2026-08-08T09:00:00.000Z"),
    agentName: "Amidou Sawadogo", // the MANAGER who submitted the closing follow-up
    credit,
  });

  assert.equal(data.responsibleUserIdAtEvent, data.creditedUserId);
  assert.equal(data.responsibleUserIdAtEvent, "commercial-a");
  assert.notEqual(data.responsibleUserIdAtEvent, "Amidou Sawadogo");
});

test("an unassigned prospect's WON transition leaves responsibleUserIdAtEvent null, same as creditedUserId — never a fabricated fallback", () => {
  const data = buildWonTransitionActivityData({
    prospectId: "prospect-1",
    occurredAt: new Date("2026-08-08T09:00:00.000Z"),
    agentName: "Amidou Sawadogo",
    credit: NO_CREDIT,
  });

  assert.equal(data.responsibleUserIdAtEvent, null);
  assert.equal(data.responsibleUserIdAtEvent, data.creditedUserId);
});
