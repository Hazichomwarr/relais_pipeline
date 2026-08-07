import assert from "node:assert/strict";
import test from "node:test";

import type { FinancialLedgerSummary, LedgerEntryRow } from "./financial-ledger.service-core";
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

test("reversal regression: a REVERSED original and its reversal both contribute, exactly like /finances", () => {
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
      // The reversal itself: an INFLOW that offsets it.
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

  assert.equal(report.summary.outflows, "25000.00");
  assert.equal(report.summary.inflows, "25000.00");
  assert.equal(report.summary.net, "0.00");
  // entryCount only counts currently-POSTED rows (excludes the reversed
  // original, includes the reversal) — same rule as /finances.
  assert.equal(report.summary.entryCount, 1);
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
