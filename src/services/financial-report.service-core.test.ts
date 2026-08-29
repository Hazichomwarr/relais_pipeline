import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  computeEffectiveFinancialLedgerSummaryCore,
  type FinancialLedgerSummary,
  type LedgerEntryRow,
} from "./financial-ledger.service-core";
import {
  computeFinancialReportCore,
  computeFinancialReportPercentChange,
} from "./financial-report.service-core";

function entry(overrides: Partial<LedgerEntryRow> = {}): LedgerEntryRow {
  return {
    id: "entry-1",
    type: "INFLOW",
    category: "CLIENT_PAYMENT",
    status: "POSTED",
    amount: "100000.00",
    currencyCode: "XOF",
    product: "KARMDA",
    counterpartyName: "École Horizon",
    reason: "Paiement",
    paymentMethod: "CASH",
    reference: null,
    occurredAt: new Date("2026-08-05T10:00:00.000Z"),
    createdByUserId: "user-1",
    createdByUserDisplayName: "Hamza Mare",
    reversalOfId: null,
    reversedById: null,
    createdAt: new Date("2026-08-05T10:00:00.000Z"),
    updatedAt: new Date("2026-08-05T10:00:00.000Z"),
    ...overrides,
  };
}

const zeroSummary: FinancialLedgerSummary = {
  currencyCode: "XOF",
  totalInflows: "0.00",
  totalOutflows: "0.00",
  balance: "0.00",
  postedEntryCount: 0,
};

test("computeFinancialReportPercentChange: positive change", () => {
  assert.equal(computeFinancialReportPercentChange("100.00", "150.00"), "50.00");
});

test("computeFinancialReportPercentChange: negative change", () => {
  assert.equal(computeFinancialReportPercentChange("200.00", "150.00"), "-25.00");
});

test("computeFinancialReportPercentChange: no change", () => {
  assert.equal(computeFinancialReportPercentChange("100.00", "100.00"), "0.00");
});

test("computeFinancialReportPercentChange: previous zero, current zero -> null (never a fake percentage)", () => {
  assert.equal(computeFinancialReportPercentChange("0.00", "0.00"), null);
});

test("computeFinancialReportPercentChange: previous zero, current positive -> null (never a fake infinite percentage)", () => {
  assert.equal(computeFinancialReportPercentChange("0.00", "500.00"), null);
});

test("an empty period returns an all-zero report with empty breakdowns", () => {
  const report = computeFinancialReportCore({
    period: { from: "2026-08-01", to: "2026-08-31", label: "Ce mois" },
    entries: [],
    previousSummary: zeroSummary,
  });

  assert.equal(report.summary.inflows, "0.00");
  assert.equal(report.summary.outflows, "0.00");
  assert.equal(report.summary.net, "0.00");
  assert.equal(report.summary.entryCount, 0);
  assert.deepEqual(report.productRevenue, []);
  assert.deepEqual(report.expenseCategories, []);
  assert.deepEqual(report.paymentMethods, []);
  assert.deepEqual(report.dailyMovement, []);
});

test("summary reuses the exact 17A Decimal arithmetic (inflows, outflows, net, entryCount)", () => {
  const report = computeFinancialReportCore({
    period: { from: "2026-08-01", to: "2026-08-31", label: "Ce mois" },
    entries: [
      entry({ id: "e1", type: "INFLOW", amount: "300000.00" }),
      entry({ id: "e2", type: "OUTFLOW", category: "FUEL", product: null, amount: "25000.00" }),
    ],
    previousSummary: zeroSummary,
  });

  assert.equal(report.summary.inflows, "300000.00");
  assert.equal(report.summary.outflows, "25000.00");
  assert.equal(report.summary.net, "275000.00");
  assert.equal(report.summary.entryCount, 2);
});

test("reversal regression (Ticket 23B — supersedes the old gross-parity expectation): /finances/reports uses the same effective movement semantics as /finances, not raw ledger volume", () => {
  const report = computeFinancialReportCore({
    period: { from: "2026-08-01", to: "2026-08-31", label: "Ce mois" },
    entries: [
      // Original outflow, now reversed.
      entry({
        id: "original",
        type: "OUTFLOW",
        category: "FUEL",
        product: null,
        amount: "25000.00",
        status: "REVERSED",
      }),
      // The reversal itself: an INFLOW that offsets it — bookkeeping,
      // not new revenue.
      entry({
        id: "reversal",
        type: "INFLOW",
        category: "OTHER_INFLOW",
        product: null,
        amount: "25000.00",
        reversalOfId: "original",
      }),
    ],
    previousSummary: zeroSummary,
  });

  assert.equal(
    report.summary.outflows,
    "0.00",
    "the REVERSED original no longer counts as a Sortie",
  );
  assert.equal(
    report.summary.inflows,
    "0.00",
    "the compensating reversal row never counts as a new Entrée",
  );
  assert.equal(report.summary.net, "0.00");
  // entryCount only counts currently-POSTED rows (excludes the reversed
  // original, includes the reversal) — unchanged rule, same as /finances.
  assert.equal(report.summary.entryCount, 1);
});

test("same-period reversal fixture reconciles Entrées − Sorties = Mouvement net (Ticket 23B production case)", () => {
  const report = computeFinancialReportCore({
    period: { from: "2026-08-01", to: "2026-08-31", label: "Ce mois" },
    entries: [
      entry({ id: "e1", type: "INFLOW", amount: "500000.00" }),
      entry({ id: "e2", type: "INFLOW", amount: "70000.00" }),
      entry({
        id: "reversed-entree",
        type: "INFLOW",
        amount: "70000.00",
        status: "REVERSED",
      }),
      entry({
        id: "reversed-entree-reversal",
        type: "OUTFLOW",
        category: "OTHER_OUTFLOW",
        product: null,
        amount: "70000.00",
        reversalOfId: "reversed-entree",
      }),
      entry({
        id: "e3",
        type: "OUTFLOW",
        category: "SALARY",
        product: null,
        amount: "355613.00",
      }),
      entry({
        id: "reversed-sortie",
        type: "OUTFLOW",
        category: "FUEL",
        product: null,
        amount: "70000.00",
        status: "REVERSED",
      }),
      entry({
        id: "reversed-sortie-reversal",
        type: "INFLOW",
        product: null,
        amount: "70000.00",
        reversalOfId: "reversed-sortie",
      }),
    ],
    previousSummary: zeroSummary,
  });

  assert.equal(report.summary.inflows, "570000.00");
  assert.equal(report.summary.outflows, "355613.00");
  assert.equal(report.summary.net, "214387.00");
});

test("Écritures (Ticket 23B audit): the report count stays status-based — POSTED rows are counted, including a reversal bookkeeping row, only a REVERSED original is excluded", () => {
  const report = computeFinancialReportCore({
    period: { from: "2026-08-01", to: "2026-08-31", label: "Ce mois" },
    entries: [
      entry({ id: "normal-1", type: "INFLOW", amount: "500000.00" }),
      entry({ id: "normal-2", type: "OUTFLOW", category: "SALARY", product: null, amount: "100000.00" }),
      entry({
        id: "reversed-original",
        type: "INFLOW",
        amount: "70000.00",
        status: "REVERSED",
      }),
      entry({
        id: "reversal-row",
        type: "OUTFLOW",
        category: "OTHER_OUTFLOW",
        product: null,
        amount: "70000.00",
        reversalOfId: "reversed-original",
      }),
    ],
    previousSummary: zeroSummary,
  });

  // 4 rows total, 1 REVERSED original excluded -> 3 currently-registered
  // écritures (the 2 normal rows plus the reversal bookkeeping row,
  // which is itself a legitimate, currently POSTED entry).
  assert.equal(report.summary.entryCount, 3);
});

test("cross-period reversal fixture: a July original reversed in August contributes 0 to both periods' reports (Ticket 23B)", () => {
  // The July report only ever sees the July original — the date-range
  // query (financial-report.service.ts) never fetches the August
  // reversal row for a July-scoped report in the first place.
  const julyReport = computeFinancialReportCore({
    period: { from: "2026-07-01", to: "2026-07-31", label: "Juillet" },
    entries: [
      entry({
        id: "july-original",
        type: "INFLOW",
        category: "CLIENT_PAYMENT",
        product: "KARMDA",
        amount: "100000.00",
        status: "REVERSED",
        occurredAt: new Date("2026-07-20T10:00:00Z"),
      }),
    ],
    previousSummary: zeroSummary,
  });

  assert.equal(
    julyReport.summary.inflows,
    "0.00",
    "the July report reopened after the August reversal excludes the now-REVERSED original",
  );
  assert.deepEqual(
    julyReport.productRevenue,
    [],
    "a reversed CLIENT_PAYMENT no longer appears as product revenue",
  );

  // The August report only ever sees the August reversal row — the
  // July original falls outside its date range entirely.
  const augustReport = computeFinancialReportCore({
    period: { from: "2026-08-01", to: "2026-08-31", label: "Août" },
    entries: [
      entry({
        id: "august-reversal",
        type: "OUTFLOW",
        category: "OTHER_OUTFLOW",
        product: null,
        amount: "100000.00",
        reversalOfId: "july-original",
        occurredAt: new Date("2026-08-05T10:00:00Z"),
      }),
    ],
    previousSummary: zeroSummary,
  });

  assert.equal(
    augustReport.summary.outflows,
    "0.00",
    "the August bookkeeping reversal never appears as new August Sortie",
  );
});

test("parity: the effective summary agrees between /finances (getEffectiveFinancialLedgerSummaryCore) and /finances/reports (computeFinancialReportCore) over the same dataset (Ticket 23B)", () => {
  const entries = [
    entry({ id: "e1", type: "INFLOW", amount: "500000.00" }),
    entry({ id: "e2", type: "INFLOW", amount: "70000.00" }),
    entry({
      id: "reversed-entree",
      type: "INFLOW",
      amount: "70000.00",
      status: "REVERSED",
    }),
    entry({
      id: "reversed-entree-reversal",
      type: "OUTFLOW",
      category: "OTHER_OUTFLOW",
      product: null,
      amount: "70000.00",
      reversalOfId: "reversed-entree",
    }),
    entry({
      id: "e3",
      type: "OUTFLOW",
      category: "SALARY",
      product: null,
      amount: "355613.00",
    }),
  ];

  const dashboardSummary = computeEffectiveFinancialLedgerSummaryCore(
    entries.map((e) => ({
      type: e.type,
      status: e.status,
      reversalOfId: e.reversalOfId,
      amount: e.amount,
    })),
  );

  const report = computeFinancialReportCore({
    period: { from: "2026-08-01", to: "2026-08-31", label: "Ce mois" },
    entries,
    previousSummary: zeroSummary,
  });

  assert.equal(report.summary.inflows, dashboardSummary.totalInflows);
  assert.equal(report.summary.outflows, dashboardSummary.totalOutflows);
  assert.equal(report.summary.net, dashboardSummary.balance);
});

test("product revenue only counts INFLOW + CLIENT_PAYMENT + a non-null product", () => {
  const report = computeFinancialReportCore({
    period: { from: "2026-08-01", to: "2026-08-31", label: "Ce mois" },
    entries: [
      entry({ id: "e1", product: "KARMDA", amount: "850000.00" }),
      entry({ id: "e2", product: "LOKARI", amount: "500000.00" }),
      entry({ id: "e3", product: "KARMDA", amount: "150000.00" }),
      // Excluded: inflow but not a client payment.
      entry({
        id: "e4",
        category: "CAPITAL_CONTRIBUTION",
        product: null,
        amount: "1000000.00",
      }),
      entry({
        id: "e5",
        category: "LOAN_RECEIVED",
        product: null,
        amount: "2000000.00",
      }),
      entry({
        id: "e6",
        category: "REFUND_RECEIVED",
        product: null,
        amount: "10000.00",
      }),
    ],
    previousSummary: zeroSummary,
  });

  assert.equal(report.productRevenue.length, 2);

  const karmda = report.productRevenue.find((row) => row.product === "KARMDA");
  const lokari = report.productRevenue.find((row) => row.product === "LOKARI");

  assert.ok(karmda);
  assert.equal(karmda!.amount, "1000000.00");
  assert.equal(karmda!.entryCount, 2);
  assert.equal(karmda!.percentOfClientRevenue, "66.67");

  assert.ok(lokari);
  assert.equal(lokari!.amount, "500000.00");
  assert.equal(lokari!.percentOfClientRevenue, "33.33");

  // Highest amount first.
  assert.equal(report.productRevenue[0].product, "KARMDA");
});

test("effective revenue (Ticket 23B): a reversed KARMDA payment and its reversal row are excluded from Revenus par produit", () => {
  const report = computeFinancialReportCore({
    period: { from: "2026-08-01", to: "2026-08-31", label: "Ce mois" },
    entries: [
      // Posted KARMDA inflow: counted.
      entry({ id: "posted", product: "KARMDA", amount: "300000.00" }),
      // Reversed KARMDA inflow: excluded.
      entry({
        id: "reversed",
        product: "KARMDA",
        amount: "150000.00",
        status: "REVERSED",
      }),
      // Its reversal bookkeeping row: typed OUTFLOW, so it already fails
      // the INFLOW check, but reversalOfId also excludes it explicitly.
      entry({
        id: "reversal",
        type: "OUTFLOW",
        category: "OTHER_OUTFLOW",
        product: null,
        amount: "150000.00",
        reversalOfId: "reversed",
      }),
    ],
    previousSummary: zeroSummary,
  });

  assert.equal(report.productRevenue.length, 1);
  const karmda = report.productRevenue.find((row) => row.product === "KARMDA");
  assert.ok(karmda);
  assert.equal(karmda!.amount, "300000.00");
  assert.equal(karmda!.entryCount, 1);
  assert.equal(karmda!.percentOfClientRevenue, "100.00");
});

test("expense categories group outflows only, highest amount first, with correct percentOfOutflows", () => {
  const report = computeFinancialReportCore({
    period: { from: "2026-08-01", to: "2026-08-31", label: "Ce mois" },
    entries: [
      entry({
        id: "e1",
        type: "OUTFLOW",
        category: "SALARY",
        product: null,
        amount: "300000.00",
      }),
      entry({
        id: "e2",
        type: "OUTFLOW",
        category: "TRANSPORT",
        product: null,
        amount: "95000.00",
      }),
      entry({
        id: "e3",
        type: "OUTFLOW",
        category: "TRANSPORT",
        product: null,
        amount: "5000.00",
      }),
      // Inflow categories must never leak into the expense breakdown.
      entry({ id: "e4", type: "INFLOW", category: "CLIENT_PAYMENT" }),
    ],
    previousSummary: zeroSummary,
  });

  assert.equal(report.expenseCategories.length, 2);
  assert.equal(report.expenseCategories[0].category, "SALARY");
  assert.equal(report.expenseCategories[0].amount, "300000.00");
  assert.equal(report.expenseCategories[0].percentOfOutflows, "75.00");
  assert.equal(report.expenseCategories[1].category, "TRANSPORT");
  assert.equal(report.expenseCategories[1].amount, "100000.00");
  assert.equal(report.expenseCategories[1].entryCount, 2);
  assert.equal(report.expenseCategories[1].percentOfOutflows, "25.00");
});

test("Sorties par catégorie (Ticket 23B): a reversed Équipement outflow and its reversal row don't affect the total, the category amount, its count, or its percentage", () => {
  const report = computeFinancialReportCore({
    period: { from: "2026-08-01", to: "2026-08-31", label: "Ce mois" },
    entries: [
      entry({
        id: "posted",
        type: "OUTFLOW",
        category: "PRINTING",
        product: null,
        amount: "50000.00",
      }),
      // Reversed outflow: must not add to PRINTING's total, count, or
      // percentage.
      entry({
        id: "reversed-outflow",
        type: "OUTFLOW",
        category: "PRINTING",
        product: null,
        amount: "70000.00",
        status: "REVERSED",
      }),
      // Its compensating reversal: typed INFLOW, must not appear as
      // product revenue or otherwise leak into another category's
      // outflow total.
      entry({
        id: "reversal",
        type: "INFLOW",
        category: "OTHER_INFLOW",
        product: null,
        amount: "70000.00",
        reversalOfId: "reversed-outflow",
      }),
    ],
    previousSummary: zeroSummary,
  });

  assert.equal(report.summary.outflows, "50000.00");
  assert.equal(report.expenseCategories.length, 1);
  assert.equal(report.expenseCategories[0].category, "PRINTING");
  assert.equal(report.expenseCategories[0].amount, "50000.00");
  assert.equal(report.expenseCategories[0].entryCount, 1);
  assert.equal(report.expenseCategories[0].percentOfOutflows, "100.00");
  assert.deepEqual(
    report.productRevenue,
    [],
    "the reversal row is not a CLIENT_PAYMENT, so it never appears as product revenue anyway",
  );
});

test("payment methods combine inflow and outflow magnitudes as volume, never netted", () => {
  const report = computeFinancialReportCore({
    period: { from: "2026-08-01", to: "2026-08-31", label: "Ce mois" },
    entries: [
      entry({ id: "e1", type: "INFLOW", paymentMethod: "CASH", amount: "300000.00" }),
      entry({
        id: "e2",
        type: "OUTFLOW",
        category: "FUEL",
        product: null,
        paymentMethod: "CASH",
        amount: "20000.00",
      }),
      entry({
        id: "e3",
        type: "INFLOW",
        paymentMethod: "MOBILE_MONEY",
        amount: "50000.00",
      }),
    ],
    previousSummary: zeroSummary,
  });

  const cash = report.paymentMethods.find((row) => row.paymentMethod === "CASH");
  assert.ok(cash);
  assert.equal(cash!.amount, "320000.00");
  assert.equal(cash!.entryCount, 2);

  const mobileMoney = report.paymentMethods.find(
    (row) => row.paymentMethod === "MOBILE_MONEY",
  );
  assert.ok(mobileMoney);
  assert.equal(mobileMoney!.amount, "50000.00");
});

test("daily movement aggregates same-day entries and keeps separate days separate, in ascending order", () => {
  const report = computeFinancialReportCore({
    period: { from: "2026-08-01", to: "2026-08-31", label: "Ce mois" },
    entries: [
      entry({
        id: "e1",
        type: "INFLOW",
        amount: "300000.00",
        occurredAt: new Date("2026-08-06T09:00:00.000Z"),
      }),
      entry({
        id: "e2",
        type: "OUTFLOW",
        category: "FUEL",
        product: null,
        amount: "25000.00",
        occurredAt: new Date("2026-08-06T18:00:00.000Z"),
      }),
      entry({
        id: "e3",
        type: "INFLOW",
        amount: "100000.00",
        occurredAt: new Date("2026-08-05T09:00:00.000Z"),
      }),
    ],
    previousSummary: zeroSummary,
  });

  assert.equal(report.dailyMovement.length, 2);
  assert.equal(report.dailyMovement[0].date, "2026-08-05");
  assert.equal(report.dailyMovement[1].date, "2026-08-06");
  assert.equal(report.dailyMovement[1].inflows, "300000.00");
  assert.equal(report.dailyMovement[1].outflows, "25000.00");
  assert.equal(report.dailyMovement[1].net, "275000.00");
});

test("comparison passes the previous-period summary through and computes each change percent", () => {
  const report = computeFinancialReportCore({
    period: { from: "2026-08-01", to: "2026-08-31", label: "Ce mois" },
    entries: [entry({ id: "e1", type: "INFLOW", amount: "236000.00" })],
    previousSummary: {
      currencyCode: "XOF",
      totalInflows: "200000.00",
      totalOutflows: "50000.00",
      balance: "150000.00",
      postedEntryCount: 3,
    },
  });

  assert.equal(report.comparison.previousInflows, "200000.00");
  assert.equal(report.comparison.previousOutflows, "50000.00");
  assert.equal(report.comparison.previousNet, "150000.00");
  assert.equal(report.comparison.inflowChangePercent, "18.00");
  // previous outflow 50000, current outflow 0 (no outflow entries this
  // period) -> a real, computable -100% change, not a null/fake value.
  assert.equal(report.comparison.outflowChangePercent, "-100.00");
});

// ---------------------------------------------------------------------------
// Ticket 25N §18/§27/§44 — reports are role-blind by construction
// ---------------------------------------------------------------------------

test("Ticket 25N §18/§44: computeFinancialReportCore takes no role or actor parameter — an ADMIN and an ASSISTANT viewing the same period/data get identical numbers, not a role-forked calculation", () => {
  const source = readFileSync("src/services/financial-report.service-core.ts", "utf8");

  const signatureMatch = source.match(
    /export function computeFinancialReportCore\(params: \{[\s\S]*?\}\)/,
  );
  assert.ok(signatureMatch, "expected to find computeFinancialReportCore's signature");
  assert.doesNotMatch(signatureMatch![0], /role/i);
  assert.doesNotMatch(signatureMatch![0], /actor/i);
  assert.doesNotMatch(source, /actor\.role|user\.role|UserRole/);
});
