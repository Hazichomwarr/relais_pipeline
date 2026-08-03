import assert from "node:assert/strict";
import test from "node:test";

import {
  reconcileProspectOwners,
  type ProspectOwnerMapping,
  type ReconciliationDependencies,
} from "./prospect-owner-reconciliation";

type ProspectState = {
  id: string;
  agentName: string;
  assignedUserId: string | null;
};

test("updates only exact reviewed names with null assignments", async () => {
  const store = createStore([
    prospect("p1", "Awa Traoré"),
    prospect("p2", "AWA TRAORE"),
    prospect("p3", "awa traore"),
    prospect("p4", "Awa Traoré", "existing-user"),
  ]);
  const mappings = [
    {
      userId: "user-1",
      historicalAgentNames: ["Awa Traoré", "AWA TRAORE"],
    },
  ];
  const result = await reconcileProspectOwners(mappings, store.dependencies);

  assert.equal(result[0].matched, 2);
  assert.equal(store.prospects[0].assignedUserId, "user-1");
  assert.equal(store.prospects[1].assignedUserId, "user-1");
  assert.equal(store.prospects[2].assignedUserId, null);
  assert.equal(store.prospects[3].assignedUserId, "existing-user");
  assert.deepEqual(
    store.prospects.map((item) => item.agentName),
    ["Awa Traoré", "AWA TRAORE", "awa traore", "Awa Traoré"],
  );
});

test("rejects duplicate historical mappings before opening a transaction", async () => {
  const store = createStore([prospect("p1", "Awa Traoré")]);
  const mappings: ProspectOwnerMapping[] = [
    { userId: "user-1", historicalAgentNames: ["Awa Traoré"] },
    { userId: "user-2", historicalAgentNames: ["Awa Traoré"] },
  ];

  await assert.rejects(
    reconcileProspectOwners(mappings, store.dependencies),
    /maps to both/,
  );
  assert.equal(store.transactionCalls, 0);
  assert.equal(store.prospects[0].assignedUserId, null);
});

test("missing mapped User fails and rolls back every assignment", async () => {
  const store = createStore([
    prospect("p1", "Awa Traoré"),
    prospect("p2", "Koane Amidou"),
  ]);
  const mappings: ProspectOwnerMapping[] = [
    { userId: "user-1", historicalAgentNames: ["Awa Traoré"] },
    { userId: "missing", historicalAgentNames: ["Koane Amidou"] },
  ];

  await assert.rejects(
    reconcileProspectOwners(mappings, store.dependencies),
    /Mapped User not found: missing/,
  );
  assert.deepEqual(
    store.prospects.map((item) => item.assignedUserId),
    [null, null],
  );
});

test("a failure after an update rolls back all assignments", async () => {
  const store = createStore(
    [prospect("p1", "Awa Traoré"), prospect("p2", "Koane Amidou")],
    true,
  );
  const mappings: ProspectOwnerMapping[] = [
    { userId: "user-1", historicalAgentNames: ["Awa Traoré"] },
    { userId: "user-1", historicalAgentNames: ["Koane Amidou"] },
  ];

  await assert.rejects(
    reconcileProspectOwners(mappings, store.dependencies),
    /Simulated reconciliation failure/,
  );
  assert.deepEqual(
    store.prospects.map((item) => item.assignedUserId),
    [null, null],
  );
});

function prospect(
  id: string,
  agentName: string,
  assignedUserId: string | null = null,
): ProspectState {
  return { id, agentName, assignedUserId };
}

function createStore(initial: ProspectState[], failSecondUpdate = false) {
  const prospects = initial.map((item) => ({ ...item }));
  let transactionCalls = 0;
  let updateCalls = 0;

  const dependencies: ReconciliationDependencies = {
    runTransaction: async (work) => {
      transactionCalls += 1;
      const staged = prospects.map((item) => ({ ...item }));
      const result = await work({
        findUsersByIds: async (userIds) =>
          userIds
            .filter((id) => id !== "missing")
            .map((id) => ({ id, role: "COMMERCIAL" as const })),
        countUnassigned: async (names) =>
          staged.filter(
            (item) =>
              item.assignedUserId === null && names.includes(item.agentName),
          ).length,
        assignUnassigned: async (userId, names) => {
          updateCalls += 1;
          if (failSecondUpdate && updateCalls === 2) {
            throw new Error("Simulated reconciliation failure");
          }

          let count = 0;
          for (const item of staged) {
            if (
              item.assignedUserId === null &&
              names.includes(item.agentName)
            ) {
              item.assignedUserId = userId;
              count += 1;
            }
          }
          return count;
        },
      });

      prospects.splice(0, prospects.length, ...staged);
      return result;
    },
  };

  return {
    prospects,
    dependencies,
    get transactionCalls() {
      return transactionCalls;
    },
  };
}
