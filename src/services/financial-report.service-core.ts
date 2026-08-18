import { Prisma } from "@prisma/client";
import type {
  LedgerEntryCategory,
  PaymentMethod,
  RelaisProduct,
} from "@prisma/client";

import { formatBusinessIsoDate } from "@/src/lib/financial-report-period";
import {
  computeEffectiveFinancialLedgerSummaryCore,
  isEffectiveLedgerMovement,
  type FinancialLedgerSummary,
  type LedgerEntryRow,
} from "@/src/services/financial-ledger.service-core";

export type FinancialReportPeriodDto = {
  from: string;
  to: string;
  label: string;
};

export type FinancialReportSummaryDto = {
  inflows: string;
  outflows: string;
  net: string;
  entryCount: number;
};

export type FinancialReportComparisonDto = {
  previousInflows: string;
  previousOutflows: string;
  previousNet: string;
  inflowChangePercent: string | null;
  outflowChangePercent: string | null;
  netChangePercent: string | null;
};

export type FinancialReportProductRevenue = {
  product: RelaisProduct;
  amount: string;
  entryCount: number;
  percentOfClientRevenue: string;
};

export type FinancialReportExpenseCategory = {
  category: LedgerEntryCategory;
  amount: string;
  entryCount: number;
  percentOfOutflows: string;
};

export type FinancialReportPaymentMethod = {
  paymentMethod: PaymentMethod;
  amount: string;
  entryCount: number;
};

export type FinancialReportDailyMovement = {
  date: string;
  inflows: string;
  outflows: string;
  net: string;
};

export type FinancialReport = {
  period: FinancialReportPeriodDto;
  summary: FinancialReportSummaryDto;
  comparison: FinancialReportComparisonDto;
  productRevenue: FinancialReportProductRevenue[];
  expenseCategories: FinancialReportExpenseCategory[];
  paymentMethods: FinancialReportPaymentMethod[];
  dailyMovement: FinancialReportDailyMovement[];
};

/**
 * previous = 0 always returns null — a 0 → 0 change and a 0 → positive
 * "infinite" change are both meaningless to display, so neither is
 * approximated as a number (spec: never show a fake infinite percentage).
 */
export function computeFinancialReportPercentChange(
  previous: string,
  current: string,
): string | null {
  const previousDecimal = new Prisma.Decimal(previous);

  if (previousDecimal.isZero()) {
    return null;
  }

  const currentDecimal = new Prisma.Decimal(current);
  return currentDecimal
    .minus(previousDecimal)
    .dividedBy(previousDecimal)
    .times(100)
    .toFixed(2);
}

/**
 * Product revenue means INFLOW + CLIENT_PAYMENT + a non-null product
 * (Ticket 17C) — capital contributions, loans, and generic refunds never
 * count here even though they're also inflows. Only effective movements
 * count (Ticket 23B): a reversed CLIENT_PAYMENT contributes 0, and its
 * compensating reversal row (typed OUTFLOW) never reaches this loop in
 * the first place since it fails the INFLOW check too.
 */
function buildProductRevenue(
  entries: LedgerEntryRow[],
): FinancialReportProductRevenue[] {
  const totals = new Map<
    RelaisProduct,
    { amount: Prisma.Decimal; entryCount: number }
  >();

  for (const entry of entries) {
    if (
      !isEffectiveLedgerMovement(entry) ||
      entry.type !== "INFLOW" ||
      entry.category !== "CLIENT_PAYMENT" ||
      !entry.product
    ) {
      continue;
    }

    const current = totals.get(entry.product) ?? {
      amount: new Prisma.Decimal(0),
      entryCount: 0,
    };
    current.amount = current.amount.plus(entry.amount);
    current.entryCount += 1;
    totals.set(entry.product, current);
  }

  const grandTotal = [...totals.values()].reduce(
    (sum, value) => sum.plus(value.amount),
    new Prisma.Decimal(0),
  );

  return [...totals.entries()]
    .map(([product, { amount, entryCount }]) => ({
      product,
      amount: amount.toFixed(2),
      entryCount,
      percentOfClientRevenue: grandTotal.isZero()
        ? "0.00"
        : amount.dividedBy(grandTotal).times(100).toFixed(2),
    }))
    .sort((a, b) => new Prisma.Decimal(b.amount).comparedTo(a.amount));
}

/** Every effective OUTFLOW entry belongs to exactly one category, so the
 * category totals always partition — and sum to exactly — the period's
 * effective total outflows; no separate "total outflows" query is
 * needed here. Only effective movements count (Ticket 23B): a reversed
 * outflow contributes 0 to its category, and its compensating reversal
 * row (typed INFLOW) never reaches this loop since it fails the
 * OUTFLOW check too. */
function buildExpenseCategories(
  entries: LedgerEntryRow[],
): FinancialReportExpenseCategory[] {
  const totals = new Map<
    LedgerEntryCategory,
    { amount: Prisma.Decimal; entryCount: number }
  >();

  for (const entry of entries) {
    if (!isEffectiveLedgerMovement(entry) || entry.type !== "OUTFLOW") {
      continue;
    }

    const current = totals.get(entry.category) ?? {
      amount: new Prisma.Decimal(0),
      entryCount: 0,
    };
    current.amount = current.amount.plus(entry.amount);
    current.entryCount += 1;
    totals.set(entry.category, current);
  }

  const grandTotal = [...totals.values()].reduce(
    (sum, value) => sum.plus(value.amount),
    new Prisma.Decimal(0),
  );

  return [...totals.entries()]
    .map(([category, { amount, entryCount }]) => ({
      category,
      amount: amount.toFixed(2),
      entryCount,
      percentOfOutflows: grandTotal.isZero()
        ? "0.00"
        : amount.dividedBy(grandTotal).times(100).toFixed(2),
    }))
    .sort((a, b) => new Prisma.Decimal(b.amount).comparedTo(a.amount));
}

/**
 * "Volume des mouvements par mode de paiement" — inflow and outflow
 * amounts are added together as raw magnitudes (never netted), since
 * this represents activity through a channel, not revenue.
 */
function buildPaymentMethods(
  entries: LedgerEntryRow[],
): FinancialReportPaymentMethod[] {
  const totals = new Map<
    PaymentMethod,
    { amount: Prisma.Decimal; entryCount: number }
  >();

  for (const entry of entries) {
    const current = totals.get(entry.paymentMethod) ?? {
      amount: new Prisma.Decimal(0),
      entryCount: 0,
    };
    current.amount = current.amount.plus(entry.amount);
    current.entryCount += 1;
    totals.set(entry.paymentMethod, current);
  }

  return [...totals.entries()]
    .map(([paymentMethod, { amount, entryCount }]) => ({
      paymentMethod,
      amount: amount.toFixed(2),
      entryCount,
    }))
    .sort((a, b) => new Prisma.Decimal(b.amount).comparedTo(a.amount));
}

/** Only calendar days with at least one entry are returned, in ascending
 * order — a quiet day contributes no row rather than a zero row. */
function buildDailyMovement(
  entries: LedgerEntryRow[],
): FinancialReportDailyMovement[] {
  const totals = new Map<
    string,
    { inflows: Prisma.Decimal; outflows: Prisma.Decimal }
  >();

  for (const entry of entries) {
    const dateLabel = formatBusinessIsoDate(entry.occurredAt);
    const current = totals.get(dateLabel) ?? {
      inflows: new Prisma.Decimal(0),
      outflows: new Prisma.Decimal(0),
    };

    if (entry.type === "INFLOW") {
      current.inflows = current.inflows.plus(entry.amount);
    } else {
      current.outflows = current.outflows.plus(entry.amount);
    }

    totals.set(dateLabel, current);
  }

  return [...totals.entries()]
    .map(([date, { inflows, outflows }]) => ({
      date,
      inflows: inflows.toFixed(2),
      outflows: outflows.toFixed(2),
      net: inflows.minus(outflows).toFixed(2),
    }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * The top-line summary, the expense-category breakdown, and the
 * product-revenue breakdown all report effective business movement, not
 * raw ledger volume (Ticket 23B — the same isEffectiveLedgerMovement
 * rule 23A established for /finances): a REVERSED original and its
 * compensating reversal row both contribute 0 CFA, wherever in time
 * each of the pair falls, so a reversal dated in a later period never
 * masquerades as new revenue or expense in that later period's report.
 * The payment-method breakdown and the daily-movement chart are
 * deliberately left as raw/gross figures — they represent processing
 * volume through a channel and a day-by-day activity trace, not a
 * business revenue/expense total, and 23B does not touch them.
 */
export function computeFinancialReportCore(params: {
  period: FinancialReportPeriodDto;
  entries: LedgerEntryRow[];
  previousSummary: FinancialLedgerSummary;
}): FinancialReport {
  const summaryCore = computeEffectiveFinancialLedgerSummaryCore(
    params.entries.map((entry) => ({
      type: entry.type,
      status: entry.status,
      reversalOfId: entry.reversalOfId,
      amount: entry.amount,
    })),
  );

  const inflows = new Prisma.Decimal(summaryCore.totalInflows);
  const outflows = new Prisma.Decimal(summaryCore.totalOutflows);
  const net = inflows.minus(outflows);

  const previousInflows = new Prisma.Decimal(
    params.previousSummary.totalInflows,
  );
  const previousOutflows = new Prisma.Decimal(
    params.previousSummary.totalOutflows,
  );
  const previousNet = previousInflows.minus(previousOutflows);

  return {
    period: params.period,
    summary: {
      inflows: inflows.toFixed(2),
      outflows: outflows.toFixed(2),
      net: net.toFixed(2),
      entryCount: summaryCore.postedEntryCount,
    },
    comparison: {
      previousInflows: previousInflows.toFixed(2),
      previousOutflows: previousOutflows.toFixed(2),
      previousNet: previousNet.toFixed(2),
      inflowChangePercent: computeFinancialReportPercentChange(
        params.previousSummary.totalInflows,
        summaryCore.totalInflows,
      ),
      outflowChangePercent: computeFinancialReportPercentChange(
        params.previousSummary.totalOutflows,
        summaryCore.totalOutflows,
      ),
      netChangePercent: computeFinancialReportPercentChange(
        previousNet.toFixed(2),
        net.toFixed(2),
      ),
    },
    productRevenue: buildProductRevenue(params.entries),
    expenseCategories: buildExpenseCategories(params.entries),
    paymentMethods: buildPaymentMethods(params.entries),
    dailyMovement: buildDailyMovement(params.entries),
  };
}
