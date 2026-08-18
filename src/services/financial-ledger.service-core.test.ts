import assert from "node:assert/strict";
import test from "node:test";

import type { ValidatedLedgerEntryInput } from "@/src/lib/validations/financial-ledger.schema";

import {
  buildReversalReason,
  computeEffectiveFinancialLedgerSummaryCore,
  computeFinancialLedgerSummaryCore,
  createLedgerEntryCore,
  getEffectiveFinancialLedgerSummaryCore,
  getFinancialLedgerSummaryCore,
  getLedgerEntryByIdCore,
  getReversalTypeAndCategory,
  isEffectiveLedgerMovement,
  listLedgerEntriesCore,
  reverseLedgerEntryCore,
  type LedgerEntryDetailRow,
  type LedgerEntryServiceDependencies,
} from "./financial-ledger.service-core";

function makeEntry(
  id: string,
  overrides: Partial<LedgerEntryDetailRow> = {},
): LedgerEntryDetailRow {
  return {
    id,
    type: "OUTFLOW",
    category: "FUEL",
    status: "POSTED",
    amount: "25000.00",
    currencyCode: "XOF",
    product: null,
    counterpartyName: "Julbert Serme",
    reason: "Carburant pour la prospection terrain",
    paymentMethod: "CASH",
    reference: null,
    occurredAt: new Date("2026-08-01T12:00:00Z"),
    createdByUserId: "user-1",
    createdByUserDisplayName: "Admin Test",
    reversalOfId: null,
    reversedById: null,
    createdAt: new Date("2026-08-01T12:00:00Z"),
    updatedAt: new Date("2026-08-01T12:00:00Z"),
    reversalOf: null,
    reversedBy: null,
    ...overrides,
  };
}

function validInflowInput(
  overrides: Partial<ValidatedLedgerEntryInput> = {},
): ValidatedLedgerEntryInput {
  return {
    type: "INFLOW",
    category: "CLIENT_PAYMENT",
    amount: "300000",
    currencyCode: "XOF",
    product: "KARMDA",
    counterpartyName: "Groupe scolaire Horizon",
    reason: "Premier paiement annuel KARMDA",
    paymentMethod: "MOBILE_MONEY",
    reference: undefined,
    occurredAt: new Date("2026-08-06T12:00:00Z"),
    ...overrides,
  };
}

function validOutflowInput(
  overrides: Partial<ValidatedLedgerEntryInput> = {},
): ValidatedLedgerEntryInput {
  return {
    type: "OUTFLOW",
    category: "FUEL",
    amount: "20000",
    currencyCode: "XOF",
    product: undefined,
    counterpartyName: "Test Supplier",
    reason: "Ticket 17A verification",
    paymentMethod: "CASH",
    reference: undefined,
    occurredAt: new Date("2026-08-06T12:00:00Z"),
    ...overrides,
  };
}

function createLedgerStore(initial: LedgerEntryDetailRow[] = []) {
  const entries: LedgerEntryDetailRow[] = initial.map((entry) => ({ ...entry }));
  let counter = entries.length;

  const dependencies: LedgerEntryServiceDependencies = {
    create: async (createdByUserId, fields) => {
      counter += 1;
      const id = `entry-${counter}`;
      entries.push({
        ...fields,
        id,
        status: "POSTED",
        createdByUserId,
        createdByUserDisplayName: "Test User",
        reversalOfId: null,
        reversedById: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        reversalOf: null,
        reversedBy: null,
      });
      return { id };
    },
    list: async (filters) =>
      entries.filter((entry) => {
        if (filters.type && entry.type !== filters.type) return false;
        if (filters.category && entry.category !== filters.category) return false;
        if (filters.product && entry.product !== filters.product) return false;
        if (
          filters.paymentMethod &&
          entry.paymentMethod !== filters.paymentMethod
        )
          return false;
        if (filters.dateFrom && entry.occurredAt.getTime() < filters.dateFrom.getTime())
          return false;
        if (filters.dateTo && entry.occurredAt.getTime() > filters.dateTo.getTime())
          return false;
        return true;
      }),
    findById: async (entryId) => {
      const entry = entries.find((candidate) => candidate.id === entryId);
      return entry ? { ...entry } : null;
    },
    reverseAtomically: async ({ originalId, reversalFields, reversedByUserId }) => {
      const original = entries.find((candidate) => candidate.id === originalId);

      if (!original || original.status !== "POSTED") {
        throw new Error("LEDGER_ENTRY_CONCURRENTLY_REVERSED");
      }

      counter += 1;
      const reversalId = `entry-${counter}`;
      const reversalRow: LedgerEntryDetailRow = {
        ...reversalFields,
        id: reversalId,
        status: "POSTED",
        createdByUserId: reversedByUserId,
        createdByUserDisplayName: "Test Reverser",
        reversalOfId: originalId,
        reversedById: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        reversalOf: null,
        reversedBy: null,
      };

      original.status = "REVERSED";
      original.reversedById = reversalId;
      entries.push(reversalRow);

      return { id: reversalId };
    },
    listForSummary: async (filters) =>
      entries
        .filter((entry) => {
          if (filters.product && entry.product !== filters.product) return false;
          if (filters.dateFrom && entry.occurredAt.getTime() < filters.dateFrom.getTime())
            return false;
          if (filters.dateTo && entry.occurredAt.getTime() > filters.dateTo.getTime())
            return false;
          return true;
        })
        .map((entry) => ({
          type: entry.type,
          status: entry.status,
          reversalOfId: entry.reversalOfId,
          amount: entry.amount,
        })),
  };

  return { entries, dependencies };
}

// --- Creation ---------------------------------------------------------

test("creates an inflow entry", async () => {
  const store = createLedgerStore();
  const result = await createLedgerEntryCore(
    "user-1",
    validInflowInput(),
    store.dependencies,
  );

  assert.equal(result.success, true);
  assert.equal(store.entries[0].type, "INFLOW");
});

test("creates an outflow entry", async () => {
  const store = createLedgerStore();
  const result = await createLedgerEntryCore(
    "user-1",
    validOutflowInput(),
    store.dependencies,
  );

  assert.equal(result.success, true);
  assert.equal(store.entries[0].type, "OUTFLOW");
});

test("uses the authenticated creator's id, not any client-supplied value", async () => {
  const store = createLedgerStore();
  await createLedgerEntryCore("admin-42", validOutflowInput(), store.dependencies);

  assert.equal(store.entries[0].createdByUserId, "admin-42");
});

test("status defaults to POSTED", async () => {
  const store = createLedgerStore();
  await createLedgerEntryCore("user-1", validOutflowInput(), store.dependencies);

  assert.equal(store.entries[0].status, "POSTED");
});

test("currency is XOF", async () => {
  const store = createLedgerStore();
  await createLedgerEntryCore("user-1", validOutflowInput(), store.dependencies);

  assert.equal(store.entries[0].currencyCode, "XOF");
});

test("an omitted reference becomes null, not undefined or empty string", async () => {
  const store = createLedgerStore();
  await createLedgerEntryCore(
    "user-1",
    validOutflowInput({ reference: undefined }),
    store.dependencies,
  );

  assert.equal(store.entries[0].reference, null);
});

test("only explicit allowed fields are written — no createdByUserId/status/reversalOfId leak through raw input spreading", async () => {
  const store = createLedgerStore();
  await createLedgerEntryCore("user-1", validOutflowInput(), store.dependencies);

  assert.deepEqual(
    Object.keys(store.entries[0]).sort(),
    [
      "type",
      "category",
      "amount",
      "currencyCode",
      "product",
      "counterpartyName",
      "reason",
      "paymentMethod",
      "reference",
      "occurredAt",
      "id",
      "status",
      "createdByUserId",
      "createdByUserDisplayName",
      "reversalOfId",
      "reversedById",
      "createdAt",
      "updatedAt",
      "reversalOf",
      "reversedBy",
    ].sort(),
  );
});

test("rejects a category incompatible with the type, even if it reaches the service directly", async () => {
  const store = createLedgerStore();
  const result = await createLedgerEntryCore(
    "user-1",
    validInflowInput({ category: "SALARY", product: undefined }),
    store.dependencies,
  );

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "INVALID_LEDGER_CATEGORY");
  }
  assert.equal(store.entries.length, 0);
});

test("rejects CLIENT_PAYMENT without a product", async () => {
  const store = createLedgerStore();
  const result = await createLedgerEntryCore(
    "user-1",
    validInflowInput({ product: undefined }),
    store.dependencies,
  );

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "LEDGER_PRODUCT_REQUIRED");
  }
});

test("rejects FUEL with a product", async () => {
  const store = createLedgerStore();
  const result = await createLedgerEntryCore(
    "user-1",
    validOutflowInput({ product: "KARMDA" }),
    store.dependencies,
  );

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "LEDGER_PRODUCT_NOT_ALLOWED");
  }
});

test("returns LEDGER_CREATE_FAILED without leaking the underlying error when persistence fails", async () => {
  const store = createLedgerStore();
  store.dependencies.create = async () => {
    throw new Error("connection reset");
  };

  const result = await createLedgerEntryCore(
    "user-1",
    validOutflowInput(),
    store.dependencies,
  );

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "LEDGER_CREATE_FAILED");
    assert.doesNotMatch(result.message, /connection reset/);
  }
});

// --- Listing ------------------------------------------------------------

test("listLedgerEntriesCore returns entries ordered by occurredAt desc, then createdAt desc, then id desc", async () => {
  const store = createLedgerStore([
    makeEntry("entry-a", {
      occurredAt: new Date("2026-08-01T12:00:00Z"),
      createdAt: new Date("2026-08-01T12:00:00Z"),
    }),
    makeEntry("entry-b", {
      occurredAt: new Date("2026-08-03T12:00:00Z"),
      createdAt: new Date("2026-08-03T12:00:00Z"),
    }),
    makeEntry("entry-c", {
      occurredAt: new Date("2026-08-03T12:00:00Z"),
      createdAt: new Date("2026-08-03T09:00:00Z"),
    }),
  ]);

  const result = await listLedgerEntriesCore({}, store.dependencies);

  assert.deepEqual(
    result.map((entry) => entry.id),
    ["entry-b", "entry-c", "entry-a"],
  );
});

test("listLedgerEntriesCore filters by type, category, product, payment method, and date range", async () => {
  const store = createLedgerStore([
    makeEntry("inflow-karmda", {
      type: "INFLOW",
      category: "CLIENT_PAYMENT",
      product: "KARMDA",
      paymentMethod: "MOBILE_MONEY",
      occurredAt: new Date("2026-08-01T12:00:00Z"),
    }),
    makeEntry("outflow-fuel", {
      type: "OUTFLOW",
      category: "FUEL",
      product: null,
      paymentMethod: "CASH",
      occurredAt: new Date("2026-08-05T12:00:00Z"),
    }),
  ]);

  assert.deepEqual(
    (await listLedgerEntriesCore({ type: "INFLOW" }, store.dependencies)).map(
      (entry) => entry.id,
    ),
    ["inflow-karmda"],
  );
  assert.deepEqual(
    (await listLedgerEntriesCore({ category: "FUEL" }, store.dependencies)).map(
      (entry) => entry.id,
    ),
    ["outflow-fuel"],
  );
  assert.deepEqual(
    (await listLedgerEntriesCore({ product: "KARMDA" }, store.dependencies)).map(
      (entry) => entry.id,
    ),
    ["inflow-karmda"],
  );
  assert.deepEqual(
    (
      await listLedgerEntriesCore(
        { paymentMethod: "CASH" },
        store.dependencies,
      )
    ).map((entry) => entry.id),
    ["outflow-fuel"],
  );
  assert.deepEqual(
    (
      await listLedgerEntriesCore(
        {
          dateFrom: new Date("2026-08-04T00:00:00Z"),
          dateTo: new Date("2026-08-06T00:00:00Z"),
        },
        store.dependencies,
      )
    ).map((entry) => entry.id),
    ["outflow-fuel"],
  );
});

test("listLedgerEntriesCore supports an empty ledger", async () => {
  const store = createLedgerStore();
  const result = await listLedgerEntriesCore({}, store.dependencies);

  assert.deepEqual(result, []);
});

test("getLedgerEntryByIdCore returns null for an unknown entry", async () => {
  const store = createLedgerStore();
  const result = await getLedgerEntryByIdCore("missing", store.dependencies);

  assert.equal(result, null);
});

// --- Summary --------------------------------------------------------------

test("computeFinancialLedgerSummaryCore returns zero totals for no entries", () => {
  const summary = computeFinancialLedgerSummaryCore([]);

  assert.deepEqual(summary, {
    currencyCode: "XOF",
    totalInflows: "0.00",
    totalOutflows: "0.00",
    balance: "0.00",
    postedEntryCount: 0,
  });
});

test("inflow entries increase the balance, outflow entries decrease it", () => {
  const summary = computeFinancialLedgerSummaryCore([
    { type: "INFLOW", status: "POSTED", amount: "300000.00" },
    { type: "OUTFLOW", status: "POSTED", amount: "20000.00" },
  ]);

  assert.equal(summary.totalInflows, "300000.00");
  assert.equal(summary.totalOutflows, "20000.00");
  assert.equal(summary.balance, "280000.00");
  assert.equal(summary.postedEntryCount, 2);
});

test("multiple entries aggregate correctly without floating-point drift", () => {
  const summary = computeFinancialLedgerSummaryCore([
    { type: "INFLOW", status: "POSTED", amount: "100000.00" },
    { type: "INFLOW", status: "POSTED", amount: "0.10" },
    { type: "INFLOW", status: "POSTED", amount: "0.20" },
    { type: "OUTFLOW", status: "POSTED", amount: "50000.00" },
  ]);

  assert.equal(summary.totalInflows, "100000.30");
  assert.equal(summary.totalOutflows, "50000.00");
  assert.equal(summary.balance, "50000.30");
});

test("summary returns the XOF currency code", () => {
  const summary = computeFinancialLedgerSummaryCore([]);
  assert.equal(summary.currencyCode, "XOF");
});

test("a reversed original and its reversal net to zero in the summary", () => {
  const summary = computeFinancialLedgerSummaryCore([
    { type: "OUTFLOW", status: "REVERSED", amount: "25000.00" },
    { type: "INFLOW", status: "POSTED", amount: "25000.00" },
  ]);

  assert.equal(summary.totalOutflows, "25000.00");
  assert.equal(summary.totalInflows, "25000.00");
  assert.equal(summary.balance, "0.00");
  assert.equal(
    summary.postedEntryCount,
    1,
    "the REVERSED original no longer counts as an active posting",
  );
});

test("getFinancialLedgerSummaryCore filters by product", async () => {
  const store = createLedgerStore([
    makeEntry("karmda-payment", {
      type: "INFLOW",
      category: "CLIENT_PAYMENT",
      product: "KARMDA",
      amount: "100000.00",
    }),
    makeEntry("lokari-payment", {
      type: "INFLOW",
      category: "CLIENT_PAYMENT",
      product: "LOKARI",
      amount: "60000.00",
    }),
  ]);

  const summary = await getFinancialLedgerSummaryCore(
    { product: "KARMDA" },
    store.dependencies,
  );

  assert.equal(summary.totalInflows, "100000.00");
});

test("getFinancialLedgerSummaryCore filters by date range", async () => {
  const store = createLedgerStore([
    makeEntry("early", {
      type: "INFLOW",
      amount: "10000.00",
      occurredAt: new Date("2026-01-01T12:00:00Z"),
    }),
    makeEntry("late", {
      type: "INFLOW",
      amount: "20000.00",
      occurredAt: new Date("2026-08-01T12:00:00Z"),
    }),
  ]);

  const summary = await getFinancialLedgerSummaryCore(
    {
      dateFrom: new Date("2026-07-01T00:00:00Z"),
      dateTo: new Date("2026-08-31T00:00:00Z"),
    },
    store.dependencies,
  );

  assert.equal(summary.totalInflows, "20000.00");
});

// --- Effective summary (Ticket 23A) ----------------------------------

test("isEffectiveLedgerMovement: true only for a POSTED, non-reversal entry", () => {
  assert.equal(
    isEffectiveLedgerMovement({ status: "POSTED", reversalOfId: null }),
    true,
  );
  assert.equal(
    isEffectiveLedgerMovement({ status: "REVERSED", reversalOfId: null }),
    false,
    "a reversed original no longer counts",
  );
  assert.equal(
    isEffectiveLedgerMovement({ status: "POSTED", reversalOfId: "original-1" }),
    false,
    "a reversal bookkeeping row is never effective business movement",
  );
});

test("a normal ENTRY is counted in Entrées and affects Solde positively", () => {
  const summary = computeEffectiveFinancialLedgerSummaryCore([
    { type: "INFLOW", status: "POSTED", reversalOfId: null, amount: "70000.00" },
  ]);

  assert.equal(summary.totalInflows, "70000.00");
  assert.equal(summary.totalOutflows, "0.00");
  assert.equal(summary.balance, "70000.00");
});

test("a normal EXIT is counted in Sorties and affects Solde negatively", () => {
  const summary = computeEffectiveFinancialLedgerSummaryCore([
    { type: "OUTFLOW", status: "POSTED", reversalOfId: null, amount: "20000.00" },
  ]);

  assert.equal(summary.totalOutflows, "20000.00");
  assert.equal(summary.totalInflows, "0.00");
  assert.equal(summary.balance, "-20000.00");
});

test("a fully reversed ENTRY nets to 0 in Entrées and in Solde — its reversal row does not masquerade as a Sortie", () => {
  const summary = computeEffectiveFinancialLedgerSummaryCore([
    // The original +70 000 inflow, now annulled.
    { type: "INFLOW", status: "REVERSED", reversalOfId: null, amount: "70000.00" },
    // Its compensating reversal: bookkeeping, typed OUTFLOW, but not a
    // real Sortie.
    { type: "OUTFLOW", status: "POSTED", reversalOfId: "original-1", amount: "70000.00" },
  ]);

  assert.equal(summary.totalInflows, "0.00");
  assert.equal(summary.totalOutflows, "0.00");
  assert.equal(summary.balance, "0.00");
});

test("a fully reversed EXIT nets to 0 in Sorties and in Solde — its reversal row does not masquerade as an Entrée", () => {
  const summary = computeEffectiveFinancialLedgerSummaryCore([
    // The original -25 000 outflow, now annulled.
    { type: "OUTFLOW", status: "REVERSED", reversalOfId: null, amount: "25000.00" },
    // Its compensating reversal: bookkeeping, typed INFLOW, but not a
    // real Entrée.
    { type: "INFLOW", status: "POSTED", reversalOfId: "original-2", amount: "25000.00" },
  ]);

  assert.equal(summary.totalOutflows, "0.00");
  assert.equal(summary.totalInflows, "0.00");
  assert.equal(summary.balance, "0.00");
});

test("postedEntryCount still counts a reversal bookkeeping row — only a REVERSED original is excluded", () => {
  const summary = computeEffectiveFinancialLedgerSummaryCore([
    { type: "INFLOW", status: "REVERSED", reversalOfId: null, amount: "70000.00" },
    { type: "OUTFLOW", status: "POSTED", reversalOfId: "original-1", amount: "70000.00" },
  ]);

  assert.equal(summary.postedEntryCount, 1);
});

test("regression: production reversal fixture reconciles Entrées − Sorties = Solde actuel (Ticket 23A)", () => {
  const summary = computeEffectiveFinancialLedgerSummaryCore([
    // Normal entrées.
    { type: "INFLOW", status: "POSTED", reversalOfId: null, amount: "500000.00" },
    { type: "INFLOW", status: "POSTED", reversalOfId: null, amount: "70000.00" },
    // A fully reversed entrée: the original is annulled, its reversal
    // is bookkeeping only.
    { type: "INFLOW", status: "REVERSED", reversalOfId: null, amount: "70000.00" },
    { type: "OUTFLOW", status: "POSTED", reversalOfId: "reversed-entree", amount: "70000.00" },
    // Normal sortie.
    { type: "OUTFLOW", status: "POSTED", reversalOfId: null, amount: "355613.00" },
    // A fully reversed sortie: same shape, opposite direction.
    { type: "OUTFLOW", status: "REVERSED", reversalOfId: null, amount: "70000.00" },
    { type: "INFLOW", status: "POSTED", reversalOfId: "reversed-sortie", amount: "70000.00" },
  ]);

  assert.equal(summary.totalInflows, "570000.00");
  assert.equal(summary.totalOutflows, "355613.00");
  assert.equal(summary.balance, "214387.00");
});

test("getEffectiveFinancialLedgerSummaryCore reads the whole ledger, unfiltered", async () => {
  const store = createLedgerStore([
    makeEntry("in-1", { type: "INFLOW", amount: "500000.00" }),
    makeEntry("out-1", { type: "OUTFLOW", amount: "355613.00" }),
  ]);

  await reverseLedgerEntryCore(
    { entryId: "in-1", reversedByUserId: "admin-1", reason: "Double paiement" },
    store.dependencies,
  );

  const summary = await getEffectiveFinancialLedgerSummaryCore(store.dependencies);

  assert.equal(summary.totalInflows, "0.00");
  assert.equal(summary.totalOutflows, "355613.00");
  assert.equal(summary.balance, "-355613.00");
});

// --- Reversal ---------------------------------------------------------

test("reversing an OUTFLOW creates a matching INFLOW reversal", async () => {
  const store = createLedgerStore([
    makeEntry("out-1", { type: "OUTFLOW", category: "FUEL", amount: "25000.00" }),
  ]);

  const result = await reverseLedgerEntryCore(
    { entryId: "out-1", reversedByUserId: "admin-1", reason: "Erreur de saisie" },
    store.dependencies,
  );

  assert.equal(result.success, true);
  const reversal = store.entries.find((entry) => entry.reversalOfId === "out-1");
  assert.ok(reversal);
  assert.equal(reversal?.type, "INFLOW");
  assert.equal(reversal?.category, "OTHER_INFLOW");
});

test("reversing an INFLOW creates a matching OUTFLOW reversal", async () => {
  const store = createLedgerStore([
    makeEntry("in-1", {
      type: "INFLOW",
      category: "CLIENT_PAYMENT",
      product: "KARMDA",
      amount: "100000.00",
    }),
  ]);

  const result = await reverseLedgerEntryCore(
    { entryId: "in-1", reversedByUserId: "admin-1", reason: "Double paiement" },
    store.dependencies,
  );

  assert.equal(result.success, true);
  const reversal = store.entries.find((entry) => entry.reversalOfId === "in-1");
  assert.equal(reversal?.type, "OUTFLOW");
  assert.equal(reversal?.category, "OTHER_OUTFLOW");
});

test("reversal preserves amount, currency, product, and payment method", async () => {
  const store = createLedgerStore([
    makeEntry("in-1", {
      type: "INFLOW",
      category: "CLIENT_PAYMENT",
      amount: "100000.00",
      currencyCode: "XOF",
      product: "LOKARI",
      paymentMethod: "BANK_TRANSFER",
    }),
  ]);

  await reverseLedgerEntryCore(
    { entryId: "in-1", reversedByUserId: "admin-1", reason: "Erreur" },
    store.dependencies,
  );

  const reversal = store.entries.find((entry) => entry.reversalOfId === "in-1");
  assert.equal(reversal?.amount, "100000.00");
  assert.equal(reversal?.currencyCode, "XOF");
  assert.equal(reversal?.product, "LOKARI");
  assert.equal(reversal?.paymentMethod, "BANK_TRANSFER");
});

test("reversal reason names the original entry and the given reason", () => {
  const reason = buildReversalReason(
    { id: "entry-9", reference: "FAC-2026-001" },
    "Montant incorrect saisi par erreur",
  );

  assert.match(reason, /Annulation de l’écriture FAC-2026-001/);
  assert.match(reason, /Montant incorrect saisi par erreur/);
});

test("reversal reason falls back to the entry id when there is no reference", () => {
  const reason = buildReversalReason(
    { id: "entry-9", reference: null },
    "Erreur",
  );

  assert.match(reason, /Annulation de l’écriture entry-9/);
});

test("getReversalTypeAndCategory always returns a system category, never user-selectable", () => {
  assert.deepEqual(getReversalTypeAndCategory("OUTFLOW"), {
    type: "INFLOW",
    category: "OTHER_INFLOW",
  });
  assert.deepEqual(getReversalTypeAndCategory("INFLOW"), {
    type: "OUTFLOW",
    category: "OTHER_OUTFLOW",
  });
});

test("the original entry is marked REVERSED after a successful reversal", async () => {
  const store = createLedgerStore([makeEntry("out-1")]);

  await reverseLedgerEntryCore(
    { entryId: "out-1", reversedByUserId: "admin-1", reason: "Erreur" },
    store.dependencies,
  );

  const original = store.entries.find((entry) => entry.id === "out-1");
  assert.equal(original?.status, "REVERSED");
});

test("the reversal is uniquely linked to its original via reversalOfId", async () => {
  const store = createLedgerStore([makeEntry("out-1")]);

  const result = await reverseLedgerEntryCore(
    { entryId: "out-1", reversedByUserId: "admin-1", reason: "Erreur" },
    store.dependencies,
  );

  assert.equal(result.success, true);
  if (result.success) {
    const reversal = store.entries.find((entry) => entry.id === result.reversalEntryId);
    assert.equal(reversal?.reversalOfId, "out-1");
  }
});

test("double reversal is rejected", async () => {
  const store = createLedgerStore([makeEntry("out-1")]);

  const first = await reverseLedgerEntryCore(
    { entryId: "out-1", reversedByUserId: "admin-1", reason: "Erreur" },
    store.dependencies,
  );
  const second = await reverseLedgerEntryCore(
    { entryId: "out-1", reversedByUserId: "admin-1", reason: "Nouvelle tentative" },
    store.dependencies,
  );

  assert.equal(first.success, true);
  assert.equal(second.success, false);
  if (!second.success) {
    assert.equal(second.code, "LEDGER_ENTRY_ALREADY_REVERSED");
  }
});

test("reversing a reversal entry is rejected", async () => {
  const store = createLedgerStore([makeEntry("out-1")]);
  const first = await reverseLedgerEntryCore(
    { entryId: "out-1", reversedByUserId: "admin-1", reason: "Erreur" },
    store.dependencies,
  );

  assert.equal(first.success, true);
  if (first.success) {
    const second = await reverseLedgerEntryCore(
      {
        entryId: first.reversalEntryId,
        reversedByUserId: "admin-1",
        reason: "Encore",
      },
      store.dependencies,
    );

    assert.equal(second.success, false);
    if (!second.success) {
      assert.equal(second.code, "LEDGER_REVERSAL_NOT_ALLOWED");
    }
  }
});

test("reversing an unknown entry is rejected", async () => {
  const store = createLedgerStore();
  const result = await reverseLedgerEntryCore(
    { entryId: "does-not-exist", reversedByUserId: "admin-1", reason: "Erreur" },
    store.dependencies,
  );

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "LEDGER_ENTRY_NOT_FOUND");
  }
});

test("a failed reversal transaction leaves the original entry untouched", async () => {
  const store = createLedgerStore([makeEntry("out-1")]);
  store.dependencies.reverseAtomically = async () => {
    throw new Error("simulated transaction failure");
  };

  const result = await reverseLedgerEntryCore(
    { entryId: "out-1", reversedByUserId: "admin-1", reason: "Erreur" },
    store.dependencies,
  );

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "LEDGER_REVERSAL_FAILED");
  }
  assert.equal(store.entries.length, 1);
  assert.equal(store.entries[0].status, "POSTED");
});

test("original plus reversal nets to zero in the summary after reversal", async () => {
  const store = createLedgerStore([
    makeEntry("out-1", { type: "OUTFLOW", amount: "25000.00" }),
  ]);

  await reverseLedgerEntryCore(
    { entryId: "out-1", reversedByUserId: "admin-1", reason: "Erreur" },
    store.dependencies,
  );

  const summary = await getFinancialLedgerSummaryCore({}, store.dependencies);
  assert.equal(summary.balance, "0.00");
});

test("concurrent double reversal: the atomic guard only lets one of two racing reversals through", async () => {
  const store = createLedgerStore([makeEntry("out-1")]);
  const original = await store.dependencies.findById("out-1");
  assert.ok(original);

  const reversalFields = {
    type: "INFLOW" as const,
    category: "OTHER_INFLOW" as const,
    amount: original!.amount,
    currencyCode: original!.currencyCode,
    product: original!.product,
    counterpartyName: original!.counterpartyName,
    reason: buildReversalReason(original!, "Concurrent attempt"),
    paymentMethod: original!.paymentMethod,
    reference: original!.reference,
    occurredAt: new Date(),
  };

  const first = await store.dependencies.reverseAtomically({
    originalId: "out-1",
    reversalFields,
    reversedByUserId: "admin-1",
  });

  assert.ok(first.id);

  await assert.rejects(
    store.dependencies.reverseAtomically({
      originalId: "out-1",
      reversalFields,
      reversedByUserId: "admin-2",
    }),
  );

  const reversals = store.entries.filter((entry) => entry.reversalOfId === "out-1");
  assert.equal(reversals.length, 1);
});
