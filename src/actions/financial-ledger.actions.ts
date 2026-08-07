"use server";

import { revalidatePath } from "next/cache";

import { authorizeAction } from "@/src/actions/authorize-action";
import {
  financialLedgerEntrySchema,
  reverseLedgerEntrySchema,
} from "@/src/lib/validations/financial-ledger.schema";
import {
  createLedgerEntry,
  reverseLedgerEntry,
} from "@/src/services/financial-ledger.service";
import { requireAdmin } from "@/src/services/authorization.service";

export type CreateLedgerEntryActionResult =
  | { success: true; entryId: string }
  | {
      success: false;
      message: string;
      fieldErrors?: Record<string, string[] | undefined>;
    };

export type ReverseLedgerEntryActionResult =
  | { success: true; reversalEntryId: string }
  | {
      success: false;
      message: string;
      fieldErrors?: Record<string, string[] | undefined>;
    };

export async function createLedgerEntryAction(
  values: unknown,
): Promise<CreateLedgerEntryActionResult> {
  const authorization = await authorizeAction(() => requireAdmin());

  if (!authorization.ok) {
    return { success: false, message: authorization.message };
  }

  const parsed = financialLedgerEntrySchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      message: "Certaines informations du mouvement financier sont invalides.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await createLedgerEntry(authorization.user.id, parsed.data);

  if (!result.success) {
    return { success: false, message: result.message };
  }

  revalidateFinancialLedgerPaths();

  return result;
}

export async function reverseLedgerEntryAction(
  values: unknown,
): Promise<ReverseLedgerEntryActionResult> {
  const authorization = await authorizeAction(() => requireAdmin());

  if (!authorization.ok) {
    return { success: false, message: authorization.message };
  }

  const parsed = reverseLedgerEntrySchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      message: "Certaines informations sont invalides.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await reverseLedgerEntry({
    entryId: parsed.data.entryId,
    reversedByUserId: authorization.user.id,
    reason: parsed.data.reason,
  });

  if (!result.success) {
    return { success: false, message: result.message };
  }

  revalidateFinancialLedgerPaths();

  return result;
}

/**
 * Ticket 17B builds the actual /finances UI; these routes don't exist
 * yet, but revalidating them now means the ledger stays fresh from the
 * moment that UI ships, with no follow-up action-layer change required.
 */
function revalidateFinancialLedgerPaths(): void {
  revalidatePath("/finances");
  revalidatePath("/finances/ledger");
}
