import { Prisma } from "@prisma/client";
import type {
  LedgerEntryCategory,
  LedgerEntryStatus,
  LedgerEntryType,
  PaymentMethod,
  RelaisProduct,
} from "@prisma/client";

import {
  getProductRequirementForCategory,
  isCategoryAllowedForType,
  isProductValidForCategory,
} from "@/src/lib/financial-ledger-options";
import type { ValidatedLedgerEntryInput } from "@/src/lib/validations/financial-ledger.schema";

export type LedgerEntryWriteFields = {
  type: LedgerEntryType;
  category: LedgerEntryCategory;
  amount: string;
  currencyCode: string;
  product: RelaisProduct | null;
  counterpartyName: string;
  reason: string;
  paymentMethod: PaymentMethod;
  reference: string | null;
  occurredAt: Date;
};

export type LedgerEntryRow = LedgerEntryWriteFields & {
  id: string;
  status: LedgerEntryStatus;
  createdByUserId: string;
  createdByUserDisplayName: string;
  reversalOfId: string | null;
  reversedById: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type LedgerEntryReversalRef = {
  id: string;
  type: LedgerEntryType;
  amount: string;
  occurredAt: Date;
};

export type LedgerEntryDetailRow = LedgerEntryRow & {
  reversalOf: LedgerEntryReversalRef | null;
  reversedBy: LedgerEntryReversalRef | null;
};

export type LedgerEntryListFilters = {
  type?: LedgerEntryType;
  category?: LedgerEntryCategory;
  product?: RelaisProduct;
  paymentMethod?: PaymentMethod;
  dateFrom?: Date;
  dateTo?: Date;
};

export type LedgerSummaryFilters = Pick<
  LedgerEntryListFilters,
  "product" | "dateFrom" | "dateTo"
>;

export type FinancialLedgerSummary = {
  currencyCode: "XOF";
  totalInflows: string;
  totalOutflows: string;
  balance: string;
  postedEntryCount: number;
};

export type LedgerEntryErrorCode =
  | "LEDGER_ENTRY_NOT_FOUND"
  | "INVALID_LEDGER_CATEGORY"
  | "LEDGER_PRODUCT_REQUIRED"
  | "LEDGER_PRODUCT_NOT_ALLOWED"
  | "LEDGER_ENTRY_ALREADY_REVERSED"
  | "LEDGER_REVERSAL_NOT_ALLOWED"
  | "LEDGER_CREATE_FAILED"
  | "LEDGER_REVERSAL_FAILED";

export type CreateLedgerEntryResult =
  | { success: true; entryId: string }
  | { success: false; code: LedgerEntryErrorCode; message: string };

export type ReverseLedgerEntryResult =
  | { success: true; reversalEntryId: string }
  | { success: false; code: LedgerEntryErrorCode; message: string };

export type ReverseLedgerEntryParams = {
  entryId: string;
  reversedByUserId: string;
  reason: string;
};

export type ReverseAtomicallyParams = {
  originalId: string;
  reversalFields: LedgerEntryWriteFields;
  reversedByUserId: string;
};

export type LedgerEntryServiceDependencies = {
  create: (
    createdByUserId: string,
    fields: LedgerEntryWriteFields,
  ) => Promise<{ id: string }>;
  list: (filters: LedgerEntryListFilters) => Promise<LedgerEntryRow[]>;
  findById: (entryId: string) => Promise<LedgerEntryDetailRow | null>;
  /**
   * Runs inside a single DB transaction: flips the original to REVERSED
   * only if it is still POSTED (guards concurrent double reversal), then
   * inserts the reversal row. Must throw — leaving both writes undone —
   * if the original is no longer POSTED by the time the write happens.
   */
  reverseAtomically: (
    params: ReverseAtomicallyParams,
  ) => Promise<{ id: string }>;
  listForSummary: (
    filters: LedgerSummaryFilters,
  ) => Promise<
    {
      type: LedgerEntryType;
      status: LedgerEntryStatus;
      reversalOfId: string | null;
      amount: string;
    }[]
  >;
};

export function toLedgerEntryWriteFields(
  input: ValidatedLedgerEntryInput,
): LedgerEntryWriteFields {
  return {
    type: input.type,
    category: input.category,
    amount: input.amount,
    currencyCode: input.currencyCode,
    product: input.product ?? null,
    counterpartyName: input.counterpartyName,
    reason: input.reason,
    paymentMethod: input.paymentMethod,
    reference: input.reference ?? null,
    occurredAt: input.occurredAt,
  };
}

export async function createLedgerEntryCore(
  createdByUserId: string,
  input: ValidatedLedgerEntryInput,
  dependencies: Pick<LedgerEntryServiceDependencies, "create">,
): Promise<CreateLedgerEntryResult> {
  if (!isCategoryAllowedForType(input.type, input.category)) {
    return {
      success: false,
      code: "INVALID_LEDGER_CATEGORY",
      message: "Cette catégorie ne correspond pas au type de mouvement.",
    };
  }

  if (!isProductValidForCategory(input.category, input.product)) {
    const requirement = getProductRequirementForCategory(input.category);

    return requirement === "required"
      ? {
          success: false,
          code: "LEDGER_PRODUCT_REQUIRED",
          message: "Sélectionnez le produit concerné par le paiement client.",
        }
      : {
          success: false,
          code: "LEDGER_PRODUCT_NOT_ALLOWED",
          message: "Aucun produit ne doit être associé à cette catégorie.",
        };
  }

  try {
    const entry = await dependencies.create(
      createdByUserId,
      toLedgerEntryWriteFields(input),
    );
    return { success: true, entryId: entry.id };
  } catch (error) {
    console.error("Unable to create ledger entry:", error);
    return {
      success: false,
      code: "LEDGER_CREATE_FAILED",
      message: "Impossible d’enregistrer le mouvement financier.",
    };
  }
}

/**
 * occurredAt DESC, then createdAt DESC, then id DESC — the last two break
 * ties deterministically so equally-timed entries always render in the
 * same order across requests.
 */
export function compareLedgerEntriesForListing(
  left: LedgerEntryRow,
  right: LedgerEntryRow,
): number {
  const occurredDiff = right.occurredAt.getTime() - left.occurredAt.getTime();
  if (occurredDiff !== 0) {
    return occurredDiff;
  }

  const createdDiff = right.createdAt.getTime() - left.createdAt.getTime();
  if (createdDiff !== 0) {
    return createdDiff;
  }

  if (left.id === right.id) {
    return 0;
  }

  return left.id < right.id ? 1 : -1;
}

export async function listLedgerEntriesCore(
  filters: LedgerEntryListFilters,
  dependencies: Pick<LedgerEntryServiceDependencies, "list">,
): Promise<LedgerEntryRow[]> {
  const entries = await dependencies.list(filters);
  return [...entries].sort(compareLedgerEntriesForListing);
}

export async function getLedgerEntryByIdCore(
  entryId: string,
  dependencies: Pick<LedgerEntryServiceDependencies, "findById">,
): Promise<LedgerEntryDetailRow | null> {
  return dependencies.findById(entryId);
}

/**
 * A reversal never exposes a user-selectable category (Ticket 17A):
 * since inflow and outflow categories are disjoint sets, the original's
 * specific category can never be reused for the opposite-type reversal,
 * so the service deterministically falls back to the generic
 * OTHER_INFLOW / OTHER_OUTFLOW bucket for the entry type it produces.
 */
export function getReversalTypeAndCategory(originalType: LedgerEntryType): {
  type: LedgerEntryType;
  category: LedgerEntryCategory;
} {
  return originalType === "OUTFLOW"
    ? { type: "INFLOW", category: "OTHER_INFLOW" }
    : { type: "OUTFLOW", category: "OTHER_OUTFLOW" };
}

export function buildReversalReason(
  original: { id: string; reference: string | null },
  reason: string,
): string {
  const label = original.reference ?? original.id;
  return `Annulation de l’écriture ${label}. ${reason}`;
}

export async function reverseLedgerEntryCore(
  params: ReverseLedgerEntryParams,
  dependencies: Pick<
    LedgerEntryServiceDependencies,
    "findById" | "reverseAtomically"
  >,
): Promise<ReverseLedgerEntryResult> {
  const original = await dependencies.findById(params.entryId);

  if (!original) {
    return {
      success: false,
      code: "LEDGER_ENTRY_NOT_FOUND",
      message: "L’écriture financière est introuvable.",
    };
  }

  if (original.reversalOfId) {
    return {
      success: false,
      code: "LEDGER_REVERSAL_NOT_ALLOWED",
      message: "Impossible d’annuler cette écriture.",
    };
  }

  if (original.status === "REVERSED") {
    return {
      success: false,
      code: "LEDGER_ENTRY_ALREADY_REVERSED",
      message: "Cette écriture a déjà été annulée.",
    };
  }

  const { type, category } = getReversalTypeAndCategory(original.type);

  const reversalFields: LedgerEntryWriteFields = {
    type,
    category,
    amount: original.amount,
    currencyCode: original.currencyCode,
    product: original.product,
    counterpartyName: original.counterpartyName,
    reason: buildReversalReason(original, params.reason),
    paymentMethod: original.paymentMethod,
    reference: original.reference,
    occurredAt: new Date(),
  };

  try {
    const reversal = await dependencies.reverseAtomically({
      originalId: original.id,
      reversalFields,
      reversedByUserId: params.reversedByUserId,
    });
    return { success: true, reversalEntryId: reversal.id };
  } catch (error) {
    console.error("Unable to reverse ledger entry:", error);
    return {
      success: false,
      code: "LEDGER_REVERSAL_FAILED",
      message: "Impossible d’annuler cette écriture.",
    };
  }
}

/**
 * Every entry ever posted — including a REVERSED original and the
 * INFLOW/OUTFLOW reversal that cancels it — contributes to the totals.
 * Excluding the original while keeping its reversal would silently
 * invent money; keeping both is what makes the pair net to zero.
 * `status` communicates lifecycle only, never which entries count.
 * postedEntryCount narrows to currently-POSTED rows: how many entries
 * are presently "live" postings, as opposed to superseded originals.
 */
export function computeFinancialLedgerSummaryCore(
  entries: { type: LedgerEntryType; status: LedgerEntryStatus; amount: string }[],
): FinancialLedgerSummary {
  let totalInflows = new Prisma.Decimal(0);
  let totalOutflows = new Prisma.Decimal(0);
  let postedEntryCount = 0;

  for (const entry of entries) {
    const amount = new Prisma.Decimal(entry.amount);

    if (entry.type === "INFLOW") {
      totalInflows = totalInflows.plus(amount);
    } else {
      totalOutflows = totalOutflows.plus(amount);
    }

    if (entry.status === "POSTED") {
      postedEntryCount += 1;
    }
  }

  return {
    currencyCode: "XOF",
    totalInflows: totalInflows.toFixed(2),
    totalOutflows: totalOutflows.toFixed(2),
    balance: totalInflows.minus(totalOutflows).toFixed(2),
    postedEntryCount,
  };
}

export async function getFinancialLedgerSummaryCore(
  filters: LedgerSummaryFilters,
  dependencies: Pick<LedgerEntryServiceDependencies, "listForSummary">,
): Promise<FinancialLedgerSummary> {
  const entries = await dependencies.listForSummary(filters);
  return computeFinancialLedgerSummaryCore(entries);
}

/**
 * An entry counts as effective business movement only when it is both
 * an original (not itself a reversal — reversalOfId is null) and still
 * POSTED (not since reversed). This is the single rule shared by the
 * effective Entrées/Sorties/Solde figures below (Ticket 23A): it is
 * what keeps a reversed original from inflating its own direction and
 * its compensating reversal row from inflating the opposite direction.
 */
export function isEffectiveLedgerMovement(entry: {
  status: LedgerEntryStatus;
  reversalOfId: string | null;
}): boolean {
  return entry.status === "POSTED" && entry.reversalOfId === null;
}

/**
 * Effective totals for the all-time dashboard (Ticket 23A). Unlike
 * computeFinancialLedgerSummaryCore above — which sums every row ever
 * posted and is kept as-is for period-scoped financial reports, see
 * financial-report.service-core.ts — this excludes both sides of a
 * reversal pair from Entrées/Sorties: the REVERSED original (its
 * business effect has been annulled) and the compensating reversal row
 * (bookkeeping, not new business activity, even though its `type` is
 * the opposite direction). postedEntryCount keeps the same lifecycle
 * rule as the gross summary — a reversal row is a legitimate, currently
 * registered écriture, only a REVERSED original is excluded.
 *
 * This is only valid for an unscoped (all-time) read. A date-filtered
 * variant would have to decide whether a reversal dated outside the
 * queried period should still cancel an original dated inside it —
 * that policy question is unresolved (Ticket 23A audit) and deliberately
 * out of scope here.
 */
export function computeEffectiveFinancialLedgerSummaryCore(
  entries: {
    type: LedgerEntryType;
    status: LedgerEntryStatus;
    reversalOfId: string | null;
    amount: string;
  }[],
): FinancialLedgerSummary {
  let totalInflows = new Prisma.Decimal(0);
  let totalOutflows = new Prisma.Decimal(0);
  let postedEntryCount = 0;

  for (const entry of entries) {
    if (entry.status === "POSTED") {
      postedEntryCount += 1;
    }

    if (!isEffectiveLedgerMovement(entry)) {
      continue;
    }

    const amount = new Prisma.Decimal(entry.amount);

    if (entry.type === "INFLOW") {
      totalInflows = totalInflows.plus(amount);
    } else {
      totalOutflows = totalOutflows.plus(amount);
    }
  }

  return {
    currencyCode: "XOF",
    totalInflows: totalInflows.toFixed(2),
    totalOutflows: totalOutflows.toFixed(2),
    balance: totalInflows.minus(totalOutflows).toFixed(2),
    postedEntryCount,
  };
}

export async function getEffectiveFinancialLedgerSummaryCore(
  dependencies: Pick<LedgerEntryServiceDependencies, "listForSummary">,
): Promise<FinancialLedgerSummary> {
  const entries = await dependencies.listForSummary({});
  return computeEffectiveFinancialLedgerSummaryCore(entries);
}
