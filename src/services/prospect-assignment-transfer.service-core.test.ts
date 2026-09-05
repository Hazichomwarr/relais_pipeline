import assert from "node:assert/strict";
import test from "node:test";
import type { UserRole } from "@prisma/client";

import type { ValidatedReassignProspectInput } from "@/src/lib/validations/prospect-assignment-transfer.schema";
import {
  canReceiveProspectAssignment,
  reassignProspectCore,
  type ReassignProspectDependencies,
} from "./prospect-assignment-transfer.service-core";

function input(
  overrides: Partial<ValidatedReassignProspectInput> = {},
): ValidatedReassignProspectInput {
  return {
    prospectId: "prospect-1",
    newAssignedUserId: "amidou",
    reason: "Réorganisation du suivi",
    ...overrides,
  };
}

type FakeUser = { id: string; active: boolean; role: UserRole };

type FakeStoreOptions = {
  prospect: { id: string; assignedUserId: string | null };
  users?: FakeUser[];
};

type FakeTransfer = {
  id: string;
  prospectId: string;
  fromUserId: string | null;
  toUserId: string;
  changedByUserId: string;
  reason: string;
};

/**
 * Mimics one guarded transaction: the conditional "write" only succeeds
 * if the prospect's current owner still matches what the caller expected
 * — the same invariant prisma.prospect.updateMany's WHERE clause enforces
 * in the real wiring (prospect-assignment-transfer.service.ts).
 */
function createFakeStore(options: FakeStoreOptions) {
  let prospect = { ...options.prospect };
  const users = new Map((options.users ?? []).map((u) => [u.id, u]));
  const transfers: FakeTransfer[] = [];
  const reassignAttempts: Array<{
    prospectId: string;
    expected: string | null;
    target: string;
  }> = [];

  const dependencies: ReassignProspectDependencies = {
    findActor: async (id) => users.get(id) ?? null,
    findTarget: async (id) => users.get(id) ?? null,
    findProspect: async (id) =>
      prospect.id === id ? { ...prospect } : null,
    reassignAtomically: async (
      prospectId,
      expectedCurrentOwnerId,
      newAssignedUserId,
    ) => {
      reassignAttempts.push({
        prospectId,
        expected: expectedCurrentOwnerId,
        target: newAssignedUserId,
      });
      if (
        prospect.id !== prospectId ||
        prospect.assignedUserId !== expectedCurrentOwnerId
      ) {
        return { count: 0 };
      }
      prospect = { ...prospect, assignedUserId: newAssignedUserId };
      return { count: 1 };
    },
    recordTransfer: async (fields) => {
      const id = `transfer-${transfers.length + 1}`;
      transfers.push({ id, ...fields });
      return { id };
    },
  };

  return {
    dependencies,
    getProspect: () => prospect,
    getTransfers: () => transfers,
    getReassignAttempts: () => reassignAttempts,
    /**
     * Test-only: deterministically simulates a fully separate,
     * already-committed transaction landing in the gap between this
     * call's read and its own guarded write — the only way to exercise
     * Ticket 28B §32's exact race with a single-threaded fake store,
     * since reassignProspectCore always re-reads before writing (so two
     * sequential top-level calls alone never reproduce a true race — the
     * second call would just see the already-updated state and correctly
     * proceed against it, which is not what this scenario is about).
     */
    rigConcurrentWinner: (winnerId: string) => {
      const originalFindProspect = dependencies.findProspect;
      dependencies.findProspect = async (id) => {
        const snapshot = await originalFindProspect(id);
        if (snapshot) {
          prospect = { ...prospect, assignedUserId: winnerId };
        }
        return snapshot;
      };
    },
  };
}

const commercial: FakeUser = { id: "commercial-a", active: true, role: "COMMERCIAL" };
const manager: FakeUser = { id: "manager-b", active: true, role: "MANAGER" };
const admin: FakeUser = { id: "admin-1", active: true, role: "ADMIN" };
const assistant: FakeUser = { id: "assistant-1", active: true, role: "ASSISTANT" };

// ---------------------------------------------------------------------------
// canReceiveProspectAssignment — pure eligibility helper
// ---------------------------------------------------------------------------

test("canReceiveProspectAssignment: active ADMIN/COMMERCIAL/MANAGER are eligible, matching canOwnProspect", () => {
  for (const role of ["ADMIN", "COMMERCIAL", "MANAGER"] as UserRole[]) {
    assert.equal(canReceiveProspectAssignment({ role, active: true }), true);
  }
});

test("canReceiveProspectAssignment: ASSISTANT is never eligible, active or not", () => {
  assert.equal(canReceiveProspectAssignment({ role: "ASSISTANT", active: true }), false);
  assert.equal(canReceiveProspectAssignment({ role: "ASSISTANT", active: false }), false);
});

test("canReceiveProspectAssignment: an otherwise-eligible role is rejected when inactive", () => {
  for (const role of ["ADMIN", "COMMERCIAL", "MANAGER"] as UserRole[]) {
    assert.equal(canReceiveProspectAssignment({ role, active: false }), false);
  }
});

// ---------------------------------------------------------------------------
// Actor authority — role matrix (28B §16-19)
// ---------------------------------------------------------------------------

for (const actor of [admin, manager]) {
  test(`ACTOR AUTHORITY: an active ${actor.role} may reassign`, async () => {
    const store = createFakeStore({
      prospect: { id: "prospect-1", assignedUserId: "jean" },
      users: [actor, { id: "amidou", active: true, role: "COMMERCIAL" }],
    });

    const result = await reassignProspectCore(actor.id, input(), store.dependencies);
    assert.deepEqual(result, { success: true });
  });
}

for (const actor of [commercial, assistant]) {
  test(`ACTOR AUTHORITY: an active ${actor.role} may not reassign`, async () => {
    const store = createFakeStore({
      prospect: { id: "prospect-1", assignedUserId: "jean" },
      users: [actor, { id: "amidou", active: true, role: "COMMERCIAL" }],
    });

    const result = await reassignProspectCore(actor.id, input(), store.dependencies);
    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(result.code, "ACTOR_NOT_AUTHORIZED");
    }
    assert.deepEqual(store.getTransfers(), []);
    assert.equal(store.getProspect().assignedUserId, "jean");
  });
}

// ---------------------------------------------------------------------------
// Fresh actor resolution (Ticket 28A §13/§51) — never trusts the caller
// ---------------------------------------------------------------------------

test("ACTOR FRESHNESS: an actor id with no matching User row is rejected", async () => {
  const store = createFakeStore({
    prospect: { id: "prospect-1", assignedUserId: "jean" },
    users: [{ id: "amidou", active: true, role: "COMMERCIAL" }],
  });

  const result = await reassignProspectCore("ghost-actor", input(), store.dependencies);
  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "ACTOR_NOT_FOUND");
});

test("ACTOR FRESHNESS: a deactivated ADMIN/MANAGER is rejected even though their (hypothetical stale) session role would pass", async () => {
  const staleManager: FakeUser = { id: "manager-b", active: false, role: "MANAGER" };
  const store = createFakeStore({
    prospect: { id: "prospect-1", assignedUserId: "jean" },
    users: [staleManager, { id: "amidou", active: true, role: "COMMERCIAL" }],
  });

  const result = await reassignProspectCore(staleManager.id, input(), store.dependencies);
  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "ACTOR_INACTIVE");
  assert.deepEqual(store.getTransfers(), []);
});

// ---------------------------------------------------------------------------
// Prospect resolution
// ---------------------------------------------------------------------------

test("an unknown prospect is rejected", async () => {
  const store = createFakeStore({
    prospect: { id: "some-other-prospect", assignedUserId: "jean" },
    users: [manager, { id: "amidou", active: true, role: "COMMERCIAL" }],
  });

  const result = await reassignProspectCore(manager.id, input(), store.dependencies);
  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "PROSPECT_NOT_FOUND");
});

// ---------------------------------------------------------------------------
// Target resolution and eligibility (28B §14/§15/§49/§50)
// ---------------------------------------------------------------------------

test("TARGET: an unknown target is rejected", async () => {
  const store = createFakeStore({
    prospect: { id: "prospect-1", assignedUserId: "jean" },
    users: [manager],
  });

  const result = await reassignProspectCore(
    manager.id,
    input({ newAssignedUserId: "ghost-target" }),
    store.dependencies,
  );
  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "TARGET_NOT_FOUND");
});

test("TARGET: an inactive target is rejected, even if they historically own other prospects", async () => {
  const store = createFakeStore({
    prospect: { id: "prospect-1", assignedUserId: "jean" },
    users: [manager, { id: "amidou", active: false, role: "COMMERCIAL" }],
  });

  const result = await reassignProspectCore(manager.id, input(), store.dependencies);
  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "TARGET_INACTIVE");
  assert.deepEqual(store.getTransfers(), []);
});

test("TARGET: an active ASSISTANT target is rejected", async () => {
  const store = createFakeStore({
    prospect: { id: "prospect-1", assignedUserId: "jean" },
    users: [manager, assistant],
  });

  const result = await reassignProspectCore(
    manager.id,
    input({ newAssignedUserId: assistant.id }),
    store.dependencies,
  );
  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "TARGET_ROLE_NOT_ELIGIBLE");
});

for (const targetRole of ["ADMIN", "COMMERCIAL", "MANAGER"] as UserRole[]) {
  test(`TARGET: an active ${targetRole} may receive a prospect — reassignment is not commercial-only (28B §54)`, async () => {
    const target: FakeUser = { id: "target-1", active: true, role: targetRole };
    const store = createFakeStore({
      prospect: { id: "prospect-1", assignedUserId: "jean" },
      users: [manager, target],
    });

    const result = await reassignProspectCore(
      manager.id,
      input({ newAssignedUserId: target.id }),
      store.dependencies,
    );
    assert.deepEqual(result, { success: true });
  });
}

// ---------------------------------------------------------------------------
// Current owner is never validated — 28B §16/§17
// ---------------------------------------------------------------------------

test("CURRENT OWNER: an inactive or role-ineligible current owner is transferable away from — the operation never looks up the current owner's identity at all", async () => {
  const store = createFakeStore({
    prospect: { id: "prospect-1", assignedUserId: "jean" },
    // No "jean" entry in `users` at all — proves the operation never
    // needs to resolve the current owner's active/role state.
    users: [manager, { id: "amidou", active: true, role: "COMMERCIAL" }],
  });

  const result = await reassignProspectCore(manager.id, input(), store.dependencies);
  assert.deepEqual(result, { success: true });
  assert.equal(store.getProspect().assignedUserId, "amidou");
});

// ---------------------------------------------------------------------------
// Same-assignee — explicit no-op, no history (28B §25/§69)
// ---------------------------------------------------------------------------

test("SAME_ASSIGNEE: reassigning to the current owner is rejected as an explicit no-op — no Prospect update, no history row, no guarded-write attempt", async () => {
  const store = createFakeStore({
    prospect: { id: "prospect-1", assignedUserId: "jean" },
    users: [manager, { id: "jean", active: true, role: "COMMERCIAL" }],
  });

  const result = await reassignProspectCore(
    manager.id,
    input({ newAssignedUserId: "jean" }),
    store.dependencies,
  );
  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "SAME_ASSIGNEE");
  assert.deepEqual(store.getTransfers(), []);
  assert.deepEqual(
    store.getReassignAttempts(),
    [],
    "the guarded update is never even attempted for a no-op",
  );
  assert.equal(store.getProspect().assignedUserId, "jean");
});

test("SAME_ASSIGNEE after a real prior transfer: Jean → Amidou succeeds, then Amidou → Amidou is rejected, history count unchanged", async () => {
  const store = createFakeStore({
    prospect: { id: "prospect-1", assignedUserId: "jean" },
    users: [
      manager,
      { id: "amidou", active: true, role: "COMMERCIAL" },
    ],
  });

  const first = await reassignProspectCore(manager.id, input(), store.dependencies);
  assert.deepEqual(first, { success: true });
  assert.equal(store.getTransfers().length, 1);

  const second = await reassignProspectCore(
    manager.id,
    input({ newAssignedUserId: "amidou" }),
    store.dependencies,
  );
  assert.equal(second.success, false);
  if (!second.success) assert.equal(second.code, "SAME_ASSIGNEE");
  assert.equal(store.getTransfers().length, 1, "no new history row for the no-op");
});

// ---------------------------------------------------------------------------
// Null current owner — a real transition, never a fabricated prior owner
// (28B §4/§26/§67)
// ---------------------------------------------------------------------------

test("NULL OWNER: an unassigned prospect can be assigned; the transfer's fromUserId is null, never invented", async () => {
  const store = createFakeStore({
    prospect: { id: "prospect-1", assignedUserId: null },
    users: [manager, { id: "amidou", active: true, role: "COMMERCIAL" }],
  });

  const result = await reassignProspectCore(manager.id, input(), store.dependencies);
  assert.deepEqual(result, { success: true });

  const [transfer] = store.getTransfers();
  assert.equal(transfer.fromUserId, null);
  assert.equal(transfer.toUserId, "amidou");
  assert.equal(store.getProspect().assignedUserId, "amidou");
});

// ---------------------------------------------------------------------------
// Reason validation — defensive, core-level (28B §24/§70)
// ---------------------------------------------------------------------------

test("REASON: a whitespace-only reason is rejected even if it bypassed schema validation — the core does not trust the caller", async () => {
  const store = createFakeStore({
    prospect: { id: "prospect-1", assignedUserId: "jean" },
    users: [manager, { id: "amidou", active: true, role: "COMMERCIAL" }],
  });

  const result = await reassignProspectCore(
    manager.id,
    // Cast bypasses the schema's own min(5) trim/non-blank enforcement,
    // simulating a caller that skipped it entirely.
    { ...input(), reason: "   " } as ValidatedReassignProspectInput,
    store.dependencies,
  );
  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "INVALID_REASON");
  assert.deepEqual(store.getTransfers(), []);
});

test("REASON: leading/trailing whitespace is trimmed before persistence", async () => {
  const store = createFakeStore({
    prospect: { id: "prospect-1", assignedUserId: "jean" },
    users: [manager, { id: "amidou", active: true, role: "COMMERCIAL" }],
  });

  await reassignProspectCore(
    manager.id,
    input({ reason: "  Départ du commercial  " }),
    store.dependencies,
  );

  assert.equal(store.getTransfers()[0]?.reason, "Départ du commercial");
});

// ---------------------------------------------------------------------------
// Provenance — who moved it, who changed it, never confused (28B §71)
// ---------------------------------------------------------------------------

test("PROVENANCE: changedByUserId is always the resolved actor — never the target, never the prior owner", async () => {
  const store = createFakeStore({
    prospect: { id: "prospect-1", assignedUserId: "jean" },
    users: [manager, { id: "amidou", active: true, role: "COMMERCIAL" }],
  });

  await reassignProspectCore(manager.id, input(), store.dependencies);

  const [transfer] = store.getTransfers();
  assert.equal(transfer.fromUserId, "jean");
  assert.equal(transfer.toUserId, "amidou");
  assert.equal(transfer.changedByUserId, "manager-b");
});

// ---------------------------------------------------------------------------
// Actor identity vs. ownership identity are independent dimensions
// (28B §55/§56)
// ---------------------------------------------------------------------------

test("a MANAGER may reassign someone else's prospect to themselves — actor === target is allowed; only current-owner === target is a no-op", async () => {
  const store = createFakeStore({
    prospect: { id: "prospect-1", assignedUserId: "jean" },
    users: [manager],
  });

  const result = await reassignProspectCore(
    manager.id,
    input({ newAssignedUserId: manager.id }),
    store.dependencies,
  );
  assert.deepEqual(result, { success: true });

  const [transfer] = store.getTransfers();
  assert.equal(transfer.fromUserId, "jean");
  assert.equal(transfer.toUserId, "manager-b");
  assert.equal(transfer.changedByUserId, "manager-b");
});

test("a MANAGER may transfer a prospect they currently own to someone else — actor === current owner is allowed", async () => {
  const store = createFakeStore({
    prospect: { id: "prospect-1", assignedUserId: "manager-b" },
    users: [manager, { id: "amidou", active: true, role: "COMMERCIAL" }],
  });

  const result = await reassignProspectCore(manager.id, input(), store.dependencies);
  assert.deepEqual(result, { success: true });

  const [transfer] = store.getTransfers();
  assert.equal(transfer.fromUserId, "manager-b");
  assert.equal(transfer.toUserId, "amidou");
  assert.equal(transfer.changedByUserId, "manager-b");
});

// ---------------------------------------------------------------------------
// Terminal-status non-gate (28B §18) — structural: the lookup type this
// core reads has no status field at all, so a WON/LOST prospect is
// indistinguishable from any other at this layer.
// ---------------------------------------------------------------------------

test("STRUCTURAL: the prospect lookup carries no status field — terminal WON/LOST prospects need no special-casing because this core cannot see status at all", async () => {
  const store = createFakeStore({
    prospect: { id: "prospect-1", assignedUserId: "jean" },
    users: [manager, { id: "amidou", active: true, role: "COMMERCIAL" }],
  });

  assert.equal("status" in store.getProspect(), false);

  const result = await reassignProspectCore(manager.id, input(), store.dependencies);
  assert.deepEqual(result, { success: true });
});

// ---------------------------------------------------------------------------
// Structural regressions — zero capability to touch anything but
// Prospect.assignedUserId and ProspectAssignmentTransfer (28B §19-21/§40/
// §63/§64/§65)
// ---------------------------------------------------------------------------

test("STRUCTURAL: the dependency contract exposes exactly five capabilities — no dependency exists that could write ProspectActivity, ProspectAction, or any other Prospect field", () => {
  const store = createFakeStore({
    prospect: { id: "prospect-1", assignedUserId: "jean" },
    users: [manager, { id: "amidou", active: true, role: "COMMERCIAL" }],
  });

  assert.deepEqual(
    Object.keys(store.dependencies).sort(),
    ["findActor", "findProspect", "findTarget", "reassignAtomically", "recordTransfer"].sort(),
  );
});

test("STRUCTURAL: the prospect lookup type carries only id and assignedUserId — no status/interest/followUpDate/nextAction field for this core to accidentally read or imply resetting", async () => {
  const store = createFakeStore({
    prospect: { id: "prospect-1", assignedUserId: "jean" },
    users: [manager, { id: "amidou", active: true, role: "COMMERCIAL" }],
  });

  const prospect = await store.dependencies.findProspect("prospect-1");
  assert.deepEqual(Object.keys(prospect ?? {}).sort(), ["assignedUserId", "id"]);
});

test("STRUCTURAL: recordTransfer never receives an occurredAt field — the server-side timestamp is left entirely to the persistence layer's default, never authored here", async () => {
  const store = createFakeStore({
    prospect: { id: "prospect-1", assignedUserId: "jean" },
    users: [manager, { id: "amidou", active: true, role: "COMMERCIAL" }],
  });

  let recordedFields: Record<string, unknown> | undefined;
  const originalRecordTransfer = store.dependencies.recordTransfer;
  store.dependencies.recordTransfer = async (fields) => {
    recordedFields = fields;
    return originalRecordTransfer(fields);
  };

  await reassignProspectCore(manager.id, input(), store.dependencies);

  assert.ok(recordedFields);
  assert.equal("occurredAt" in recordedFields!, false);
  assert.deepEqual(
    Object.keys(recordedFields!).sort(),
    ["changedByUserId", "fromUserId", "prospectId", "reason", "toUserId"],
  );
});

test("STRUCTURAL: ValidatedReassignProspectInput carries only prospectId/newAssignedUserId/reason — no fromUserId, changedByUserId, actorRole, targetRole, or occurredAt for a crafted request to inject (28B §22/§58-61/§72)", () => {
  assert.deepEqual(
    Object.keys(input()).sort(),
    ["newAssignedUserId", "prospectId", "reason"],
  );
});

// ---------------------------------------------------------------------------
// Concurrency (28B §27-33/§68)
// ---------------------------------------------------------------------------

test("CONCURRENCY: repeated legitimate transfers produce an ordered, immutable history whose fromUserId always matches the real prior owner", async () => {
  const store = createFakeStore({
    prospect: { id: "prospect-1", assignedUserId: "jean" },
    users: [
      manager,
      { id: "jean", active: true, role: "COMMERCIAL" },
      { id: "amidou", active: true, role: "COMMERCIAL" },
      { id: "yacouba", active: true, role: "COMMERCIAL" },
    ],
  });

  await reassignProspectCore(manager.id, input({ newAssignedUserId: "amidou" }), store.dependencies);
  await reassignProspectCore(manager.id, input({ newAssignedUserId: "yacouba" }), store.dependencies);
  await reassignProspectCore(manager.id, input({ newAssignedUserId: "jean" }), store.dependencies);

  const transfers = store.getTransfers();
  assert.equal(transfers.length, 3);
  assert.deepEqual(
    transfers.map((t) => [t.fromUserId, t.toUserId]),
    [
      ["jean", "amidou"],
      ["amidou", "yacouba"],
      ["yacouba", "jean"],
    ],
  );
  assert.equal(store.getProspect().assignedUserId, "jean");
});

test("CONCURRENCY: the guard itself rejects a stale expected-owner once the row has already moved — the direct mechanism behind every conflict result", async () => {
  const store = createFakeStore({
    prospect: { id: "prospect-1", assignedUserId: "amidou" }, // already moved on
    users: [manager, { id: "yacouba", active: true, role: "COMMERCIAL" }],
  });

  const attempt = await store.dependencies.reassignAtomically(
    "prospect-1",
    "jean", // stale — the real current owner is now "amidou"
    "yacouba",
  );

  assert.equal(attempt.count, 0);
  assert.equal(store.getProspect().assignedUserId, "amidou", "the stale attempt must not have mutated anything");
});

test("CONCURRENCY (28B §32, the required scenario): two managers both read Jean; Manager 1's transfer to Amidou succeeds, Manager 2's stale transfer to Yacouba conflicts cleanly — never a silent overwrite, never two history rows from the same stale origin", async () => {
  const store = createFakeStore({
    prospect: { id: "prospect-1", assignedUserId: "jean" },
    users: [
      manager,
      { id: "amidou", active: true, role: "COMMERCIAL" },
      { id: "yacouba", active: true, role: "COMMERCIAL" },
    ],
  });

  // Manager 2's request is set up to race: the moment ITS read resolves
  // (still seeing "jean", the value both managers actually observed),
  // Manager 1's separate, already-in-flight transaction commits — Jean →
  // Amidou — simulating the real interleaving a database would produce.
  store.rigConcurrentWinner("amidou");

  const manager2Result = await reassignProspectCore(
    manager.id,
    input({ newAssignedUserId: "yacouba" }),
    store.dependencies,
  );

  assert.equal(manager2Result.success, false);
  if (!manager2Result.success) {
    assert.equal(manager2Result.code, "CONCURRENTLY_REASSIGNED");
  }

  // Never silently retried against the newly-discovered owner, and never
  // two competing history rows from the same stale "jean" origin.
  assert.equal(store.getProspect().assignedUserId, "amidou");
  assert.deepEqual(store.getTransfers(), []);
});

// ---------------------------------------------------------------------------
// Unexpected failure — controlled result, never a thrown/leaked error
// ---------------------------------------------------------------------------

test("an unexpected error while recording the transfer is reported as a controlled REASSIGN_FAILED result", async (context) => {
  context.mock.method(console, "error", () => undefined);

  const store = createFakeStore({
    prospect: { id: "prospect-1", assignedUserId: "jean" },
    users: [manager, { id: "amidou", active: true, role: "COMMERCIAL" }],
  });
  store.dependencies.recordTransfer = async () => {
    throw new Error("simulated database failure");
  };

  const result = await reassignProspectCore(manager.id, input(), store.dependencies);
  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "REASSIGN_FAILED");
  }
});
