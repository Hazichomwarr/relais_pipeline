import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/src/lib/prisma";
import type { ValidatedLedgerEntryInput } from "@/src/lib/validations/financial-ledger.schema";
import {
  createLedgerEntryCore,
  getEffectiveFinancialLedgerSummaryCore,
  getFinancialLedgerSummaryCore,
  getLedgerEntryByIdCore,
  listLedgerEntriesCore,
  reverseLedgerEntryCore,
  type LedgerEntryDetailRow,
  type LedgerEntryListFilters,
  type LedgerEntryReversalRef,
  type LedgerEntryRow,
  type LedgerEntryServiceDependencies,
  type LedgerEntryWriteFields,
  type LedgerSummaryFilters,
  type ReverseLedgerEntryParams,
} from "@/src/services/financial-ledger.service-core";

const creatorSelect = {
  firstName: true,
  lastName: true,
} satisfies Prisma.UserSelect;

const reversalRefSelect = {
  id: true,
  type: true,
  amount: true,
  occurredAt: true,
} satisfies Prisma.LedgerEntrySelect;

const entrySelect = {
  id: true,
  type: true,
  category: true,
  status: true,
  amount: true,
  currencyCode: true,
  product: true,
  counterpartyName: true,
  reason: true,
  paymentMethod: true,
  reference: true,
  occurredAt: true,
  createdByUserId: true,
  reversalOfId: true,
  createdAt: true,
  updatedAt: true,
  createdByUser: { select: creatorSelect },
  reversedBy: { select: { id: true } },
} satisfies Prisma.LedgerEntrySelect;

type EntryWithCreator = Prisma.LedgerEntryGetPayload<{ select: typeof entrySelect }>;

function toDisplayName(user: { firstName: string; lastName: string }): string {
  return `${user.firstName} ${user.lastName}`;
}

function toLedgerEntryRow(entry: EntryWithCreator): LedgerEntryRow {
  return {
    id: entry.id,
    type: entry.type,
    category: entry.category,
    status: entry.status,
    amount: entry.amount.toFixed(2),
    currencyCode: entry.currencyCode,
    product: entry.product,
    counterpartyName: entry.counterpartyName,
    reason: entry.reason,
    paymentMethod: entry.paymentMethod,
    reference: entry.reference,
    occurredAt: entry.occurredAt,
    createdByUserId: entry.createdByUserId,
    createdByUserDisplayName: toDisplayName(entry.createdByUser),
    reversalOfId: entry.reversalOfId,
    reversedById: entry.reversedBy?.id ?? null,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

function toReversalRef(
  entry: { id: string; type: string; amount: Prisma.Decimal; occurredAt: Date } | null,
): LedgerEntryReversalRef | null {
  if (!entry) {
    return null;
  }

  return {
    id: entry.id,
    type: entry.type as LedgerEntryReversalRef["type"],
    amount: entry.amount.toFixed(2),
    occurredAt: entry.occurredAt,
  };
}

function buildWhere(
  filters: LedgerEntryListFilters,
): Prisma.LedgerEntryWhereInput {
  const occurredAt: Prisma.DateTimeFilter | undefined =
    filters.dateFrom || filters.dateTo
      ? {
          ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
          ...(filters.dateTo ? { lte: filters.dateTo } : {}),
        }
      : undefined;

  return {
    type: filters.type,
    category: filters.category,
    product: filters.product,
    paymentMethod: filters.paymentMethod,
    occurredAt,
  };
}

function toWriteData(
  fields: LedgerEntryWriteFields,
): Omit<Prisma.LedgerEntryUncheckedCreateInput, "createdByUserId"> {
  return {
    type: fields.type,
    category: fields.category,
    status: "POSTED",
    amount: fields.amount,
    currencyCode: fields.currencyCode,
    product: fields.product,
    counterpartyName: fields.counterpartyName,
    reason: fields.reason,
    paymentMethod: fields.paymentMethod,
    reference: fields.reference,
    occurredAt: fields.occurredAt,
  };
}

const dependencies: LedgerEntryServiceDependencies = {
  create: async (createdByUserId, fields) =>
    prisma.ledgerEntry.create({
      data: { ...toWriteData(fields), createdByUserId },
      select: { id: true },
    }),

  list: async (filters) => {
    const entries = await prisma.ledgerEntry.findMany({
      where: buildWhere(filters),
      orderBy: [
        { occurredAt: "desc" },
        { createdAt: "desc" },
        { id: "desc" },
      ],
      select: entrySelect,
    });

    return entries.map(toLedgerEntryRow);
  },

  findById: async (entryId): Promise<LedgerEntryDetailRow | null> => {
    const entry = await prisma.ledgerEntry.findUnique({
      where: { id: entryId },
      select: {
        ...entrySelect,
        reversalOf: { select: reversalRefSelect },
        reversedBy: { select: reversalRefSelect },
      },
    });

    if (!entry) {
      return null;
    }

    return {
      ...toLedgerEntryRow(entry),
      reversedById: entry.reversedBy?.id ?? null,
      reversalOf: toReversalRef(entry.reversalOf),
      reversedBy: toReversalRef(entry.reversedBy),
    };
  },

  reverseAtomically: async ({ originalId, reversalFields, reversedByUserId }) =>
    prisma.$transaction(async (tx) => {
      const updated = await tx.ledgerEntry.updateMany({
        where: { id: originalId, status: "POSTED" },
        data: { status: "REVERSED" },
      });

      if (updated.count === 0) {
        throw new Error("LEDGER_ENTRY_CONCURRENTLY_REVERSED");
      }

      return tx.ledgerEntry.create({
        data: {
          ...toWriteData(reversalFields),
          createdByUserId: reversedByUserId,
          reversalOfId: originalId,
        },
        select: { id: true },
      });
    }),

  listForSummary: async (filters) => {
    const occurredAt: Prisma.DateTimeFilter | undefined =
      filters.dateFrom || filters.dateTo
        ? {
            ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
            ...(filters.dateTo ? { lte: filters.dateTo } : {}),
          }
        : undefined;

    const entries = await prisma.ledgerEntry.findMany({
      where: { product: filters.product, occurredAt },
      select: { type: true, status: true, reversalOfId: true, amount: true },
    });

    return entries.map((entry) => ({
      type: entry.type,
      status: entry.status,
      reversalOfId: entry.reversalOfId,
      amount: entry.amount.toFixed(2),
    }));
  },
};

export async function createLedgerEntry(
  createdByUserId: string,
  input: ValidatedLedgerEntryInput,
) {
  return createLedgerEntryCore(createdByUserId, input, dependencies);
}

export async function listLedgerEntries(filters: LedgerEntryListFilters = {}) {
  return listLedgerEntriesCore(filters, dependencies);
}

export async function getLedgerEntryById(entryId: string) {
  return getLedgerEntryByIdCore(entryId, dependencies);
}

export async function reverseLedgerEntry(params: ReverseLedgerEntryParams) {
  return reverseLedgerEntryCore(params, dependencies);
}

export async function getFinancialLedgerSummary(
  filters: LedgerSummaryFilters = {},
) {
  return getFinancialLedgerSummaryCore(filters, dependencies);
}

/**
 * The all-time effective summary for the /finances dashboard (Ticket
 * 23A) — Entrées/Sorties exclude reversed originals and their
 * compensating reversal rows, so a fully annulled transaction
 * contributes 0 CFA to either direction. Deliberately unfiltered: see
 * isEffectiveLedgerMovement's doc comment for why a date-scoped variant
 * is not offered here.
 */
export async function getEffectiveFinancialLedgerSummary() {
  return getEffectiveFinancialLedgerSummaryCore(dependencies);
}

export type LedgerEntryListItem = Awaited<
  ReturnType<typeof listLedgerEntries>
>[number];
export type LedgerEntryDetail = Awaited<ReturnType<typeof getLedgerEntryById>>;
export type FinancialLedgerSummaryResult = Awaited<
  ReturnType<typeof getFinancialLedgerSummary>
>;
