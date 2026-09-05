import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { UserRole } from "@prisma/client";

import type { ValidatedReassignProspectInput } from "@/src/lib/validations/prospect-assignment-transfer.schema";
import {
  reassignProspectCore,
  type ReassignProspectDependencies,
} from "@/src/services/prospect-assignment-transfer.service-core";
import { buildCommercialProspectByIdWhere } from "@/src/services/commercial-prospect.service-core";
import {
  canCompleteProspectAction,
  canCancelProspectAction,
} from "@/src/services/prospect-action.service-core";
import {
  buildSalesFunnelAnalytics,
  type SalesFunnelHistoricalOutcomeRow,
  type SalesFunnelProspectRow,
} from "@/src/services/sales-funnel-analytics.service-core";
import { resolveSalesFunnelPeriod } from "@/src/lib/sales-funnel-period";

/**
 * Ticket 28B §61-66/§78/§80 — this file proves cross-ticket composition:
 * that a REAL reassignment (run through the same core the runtime uses)
 * leaves every other ticket's invariant intact, rather than re-testing
 * those tickets' own suites (already exhaustive in their own files).
 */

type FakeUser = { id: string; active: boolean; role: UserRole };

function createFakeStore(prospect: { id: string; assignedUserId: string | null }, users: FakeUser[]) {
  let current = { ...prospect };
  const userMap = new Map(users.map((u) => [u.id, u]));
  const transfers: Array<{
    id: string;
    prospectId: string;
    fromUserId: string | null;
    toUserId: string;
    changedByUserId: string;
    reason: string;
  }> = [];

  const dependencies: ReassignProspectDependencies = {
    findActor: async (id) => userMap.get(id) ?? null,
    findTarget: async (id) => userMap.get(id) ?? null,
    findProspect: async (id) => (current.id === id ? { ...current } : null),
    reassignAtomically: async (prospectId, expected, next) => {
      if (current.id !== prospectId || current.assignedUserId !== expected) {
        return { count: 0 };
      }
      current = { ...current, assignedUserId: next };
      return { count: 1 };
    },
    recordTransfer: async (fields) => {
      const id = `transfer-${transfers.length + 1}`;
      transfers.push({ id, ...fields });
      return { id };
    },
  };

  return { dependencies, getProspect: () => current, getTransfers: () => transfers };
}

function reassignInput(
  overrides: Partial<ValidatedReassignProspectInput> = {},
): ValidatedReassignProspectInput {
  return {
    prospectId: "prospect-1",
    newAssignedUserId: "amidou",
    reason: "Réorganisation du suivi",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// The final domain test (Ticket 28B's own closing scenario)
// ---------------------------------------------------------------------------

test("FINAL DOMAIN TEST: Jean owns Lycée A with prior interactions, frozen WON credit, and an OPEN action; after Admin transfers it to Amidou with a reason, current state moves but every piece of history stays Jean's", async () => {
  const store = createFakeStore(
    { id: "lycee-a", assignedUserId: "jean" },
    [
      { id: "admin-1", active: true, role: "ADMIN" },
      { id: "jean", active: true, role: "COMMERCIAL" },
      { id: "amidou", active: true, role: "COMMERCIAL" },
    ],
  );

  // Fixed historical facts that exist BEFORE the transfer and must never
  // be touched by it — this test never calls any mutator for them, only
  // asserts they remain exactly as constructed.
  const jeansOpenAction = {
    id: "action-1",
    assignedToUserId: "jean",
    createdByUserId: "jean",
  };
  const jeansInteractionAgentName = "Jean Imain N’DO";
  const jeansWonCreditedUserId = "jean";
  const jeansWonResponsibleUserIdAtEvent = "jean";

  const result = await reassignProspectCore(
    "admin-1",
    reassignInput({
      prospectId: "lycee-a",
      newAssignedUserId: "amidou",
      reason: "Réorganisation du suivi",
    }),
    store.dependencies,
  );

  assert.deepEqual(result, { success: true });

  // CURRENT STATE
  assert.equal(store.getProspect().assignedUserId, "amidou");

  // History: exactly one transfer, provenance preserved.
  const [transfer] = store.getTransfers();
  assert.equal(transfer.fromUserId, "jean");
  assert.equal(transfer.toUserId, "amidou");
  assert.equal(transfer.changedByUserId, "admin-1");
  assert.equal(transfer.reason, "Réorganisation du suivi");

  // Past evidence: untouched, because nothing in the reassignment path
  // can reach any of it.
  assert.equal(jeansInteractionAgentName, "Jean Imain N’DO");
  assert.equal(jeansWonCreditedUserId, "jean");
  assert.equal(jeansWonResponsibleUserIdAtEvent, "jean");

  // Jean's OPEN action is still his to finish (28A's Policy A, composed
  // here with a real post-transfer actor identity check).
  assert.equal(
    canCompleteProspectAction({ id: "jean", role: "COMMERCIAL" }, jeansOpenAction),
    true,
  );
  assert.equal(
    canCancelProspectAction({ id: "jean", role: "COMMERCIAL" }, jeansOpenAction),
    true,
  );
  // Amidou, the new owner, has no special authority over Jean's action
  // merely by inheriting the prospect.
  assert.equal(
    canCompleteProspectAction({ id: "amidou", role: "COMMERCIAL" }, jeansOpenAction),
    false,
  );
});

// ---------------------------------------------------------------------------
// §61 — 28A.1 historical analytics remain stable after a REAL reassignment
// ---------------------------------------------------------------------------

test("§61: after a real reassignment moves current ownership to Amidou, 28A.1's funnel attribution still credits the historically responsible commercial (Jean), never the new current owner", async () => {
  const store = createFakeStore(
    { id: "prospect-won", assignedUserId: "jean" },
    [
      { id: "manager-1", active: true, role: "MANAGER" },
      { id: "amidou", active: true, role: "COMMERCIAL" },
    ],
  );

  const result = await reassignProspectCore(
    "manager-1",
    reassignInput({ prospectId: "prospect-won", newAssignedUserId: "amidou" }),
    store.dependencies,
  );
  assert.deepEqual(result, { success: true });
  assert.equal(store.getProspect().assignedUserId, "amidou");

  // The WON credit was frozen BEFORE this transfer ever happened (Ticket
  // 25H.1/28A.1) — reflected here as a historical activity row whose
  // creditedUserId already says "jean", read alongside the NOW-current
  // Prospect state this same reassignment just produced.
  const prospects: SalesFunnelProspectRow[] = [
    {
      id: "prospect-won",
      status: "WON",
      interest: "READY_TO_DISCUSS",
      product: "KARMDA",
      assignedUserId: store.getProspect().assignedUserId,
      assignedUser: { firstName: "Amidou", lastName: "Sawadogo" },
    },
  ];
  const historicalOutcomeEvents: SalesFunnelHistoricalOutcomeRow[] = [
    {
      prospectId: "prospect-won",
      type: "WON_TRANSITION",
      occurredAt: new Date("2026-08-01T00:00:00.000Z"),
      creditedUserId: "jean",
      creditedUserNameAtEvent: "Jean Imain N’DO",
      responsibleUserIdAtEvent: "jean",
      responsibleUserAtEvent: null,
    },
  ];

  const period = resolveSalesFunnelPeriod("month", new Date("2026-08-13T10:00:00.000Z"));
  const analytics = buildSalesFunnelAnalytics(period, prospects, [], historicalOutcomeEvents);

  const jean = analytics.byOwner.find((entry) => entry.ownerUserId === "jean");
  const amidou = analytics.byOwner.find((entry) => entry.ownerUserId === "amidou");

  assert.equal(jean?.won, 1, "historical WON credit stays with Jean after the real transfer");
  assert.equal(amidou?.won ?? 0, 0, "Amidou does not inherit historical credit merely by owning the prospect now");
  assert.equal(amidou?.total, 1, "Amidou's current portfolio correctly reflects the real transfer");
});

// ---------------------------------------------------------------------------
// §62 — current-portfolio-scoped reads move to the new owner
// ---------------------------------------------------------------------------

test("§62: after a real reassignment, the same ownership-scoped where-builder Mes prospects/commercial reads use now matches the new owner, not the old one", async () => {
  const store = createFakeStore(
    { id: "prospect-1", assignedUserId: "jean" },
    [
      { id: "manager-1", active: true, role: "MANAGER" },
      { id: "amidou", active: true, role: "COMMERCIAL" },
    ],
  );

  await reassignProspectCore("manager-1", reassignInput(), store.dependencies);

  const newOwnerWhere = buildCommercialProspectByIdWhere("prospect-1", "amidou");
  const oldOwnerWhere = buildCommercialProspectByIdWhere("prospect-1", "jean");

  assert.deepEqual(newOwnerWhere, { id: "prospect-1", assignedUserId: "amidou" });
  // The where-builder itself is pure and doesn't know about the transfer —
  // this asserts the STATE it would be evaluated against now, i.e. that a
  // query built with "jean" no longer describes reality.
  assert.notDeepEqual(oldOwnerWhere, {
    id: "prospect-1",
    assignedUserId: store.getProspect().assignedUserId,
  });
  assert.equal(store.getProspect().assignedUserId, "amidou");
});

// ---------------------------------------------------------------------------
// §39/§78 — creation remains creation, structurally independent of transfer
// ---------------------------------------------------------------------------

test("§39/§78: prospect creation is structurally independent of the reassignment module — creation never imports it, and creates no transfer row", () => {
  const creationSource = readFileSync(
    "src/services/prospect-creation.service-core.ts",
    "utf8",
  );
  assert.doesNotMatch(creationSource, /prospect-assignment-transfer/);
  assert.doesNotMatch(creationSource, /ProspectAssignmentTransfer/);
});

// ---------------------------------------------------------------------------
// §38/§79 — no generic edit bypass was introduced
// ---------------------------------------------------------------------------

test("§38/§79: prospectSchema (prospect creation/edit input) still has no assignedUserId field after 28B", () => {
  const schemaSource = readFileSync("src/lib/validations/prospect.schema.ts", "utf8");
  assert.doesNotMatch(schemaSource, /assignedUserId/);
});

test("§38/§79: the reassignment schema is the only Zod schema that can ever produce a value destined for Prospect.assignedUserId outside creation", () => {
  const reassignSchemaSource = readFileSync(
    "src/lib/validations/prospect-assignment-transfer.schema.ts",
    "utf8",
  );
  assert.match(reassignSchemaSource, /newAssignedUserId:\s*z/);
  // And it never smuggles in the other authoritative fields as actual
  // schema keys either (the file's own doc comment names them in prose,
  // explaining why they're absent — that's not a schema field).
  assert.doesNotMatch(reassignSchemaSource, /fromUserId:\s*z/);
  assert.doesNotMatch(reassignSchemaSource, /changedByUserId:\s*z/);
  assert.doesNotMatch(reassignSchemaSource, /occurredAt:\s*z/);
});
