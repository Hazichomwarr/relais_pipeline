import { z } from "zod";

import {
  getProductRequirementForCategory,
  isCategoryAllowedForType,
} from "@/src/lib/financial-ledger-options";
import { relaisProducts } from "@/src/lib/validations/prospect.schema";

export const ledgerEntryTypes = ["INFLOW", "OUTFLOW"] as const;

export const ledgerEntryCategories = [
  "CLIENT_PAYMENT",
  "CAPITAL_CONTRIBUTION",
  "LOAN_RECEIVED",
  "REFUND_RECEIVED",
  "OTHER_INFLOW",

  "SALARY",
  "TRANSPORT",
  "FUEL",
  "PRINTING",
  "INTERNET",
  "OFFICE_SUPPLIES",
  "EQUIPMENT",
  "TAXES_AND_FEES",
  "CLIENT_REFUND",
  "OTHER_OUTFLOW",
] as const;

export const paymentMethods = [
  "CASH",
  "BANK_TRANSFER",
  "MOBILE_MONEY",
  "CARD",
  "CHECK",
  "OTHER",
] as const;

/** Decimal(18,2): 18 total digits of precision, 2 reserved for the
 * fraction, so the integer part can hold at most 16 digits. */
const MAX_LEDGER_AMOUNT_DIGITS = 16;
export const MAX_LEDGER_AMOUNT = BigInt("9".repeat(MAX_LEDGER_AMOUNT_DIGITS));

/**
 * Normalizes to a digit-only string (never a JS number) so arbitrarily
 * large CFA integers survive validation without floating-point drift,
 * then checks required / positive / whole-number / within-range as
 * distinct issues so each failure gets its exact requested message.
 */
const amountSchema = z
  .preprocess((value) => {
    if (typeof value === "number") {
      return Number.isFinite(value) ? String(value) : String(value);
    }

    if (typeof value === "string") {
      return value.trim();
    }

    return value;
  }, z.string())
  .superRefine((value, context) => {
    if (!value) {
      context.addIssue({ code: "custom", message: "Le montant est requis." });
      return;
    }

    if (!/^-?\d+$/.test(value)) {
      context.addIssue({
        code: "custom",
        message: "Le montant en CFA doit être un nombre entier.",
      });
      return;
    }

    const numeric = BigInt(value);

    if (numeric <= BigInt(0)) {
      context.addIssue({
        code: "custom",
        message: "Le montant doit être supérieur à zéro.",
      });
      return;
    }

    if (numeric > MAX_LEDGER_AMOUNT) {
      context.addIssue({
        code: "custom",
        message: "Le montant dépasse la limite autorisée.",
      });
    }
  });

const optionalProduct = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.enum(relaisProducts).optional(),
);

const optionalReference = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}, z.string().max(150, "La référence est trop longue.").optional());

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const occurredAtSchema = z
  .preprocess((value) => {
    if (value instanceof Date) {
      return value;
    }

    if (typeof value === "string" && value) {
      return new Date(`${value}T12:00:00`);
    }

    return value;
  }, z.date({ error: "Sélectionnez une date valide." }))
  .refine(
    (date) => date.getTime() <= Date.now() + ONE_DAY_MS,
    "La date du mouvement ne peut pas être dans le futur.",
  );

/**
 * Client-submittable fields only. createdByUserId, status, and
 * reversalOfId are never accepted here — they come from the trusted
 * server workflow (authenticated session, POSTED default, reversal
 * service), never from browser input.
 */
export const financialLedgerEntrySchema = z
  .object({
    type: z
      .string()
      .min(1, "Sélectionnez le type de mouvement.")
      .pipe(
        z.enum(ledgerEntryTypes, {
          error: "Sélectionnez un type de mouvement valide.",
        }),
      ),

    category: z
      .string()
      .min(1, "Sélectionnez une catégorie.")
      .pipe(
        z.enum(ledgerEntryCategories, {
          error: "Sélectionnez une catégorie valide.",
        }),
      ),

    amount: amountSchema,

    currencyCode: z
      .literal("XOF", {
        error: "Seule la devise XOF est prise en charge.",
      })
      .default("XOF"),

    product: optionalProduct,

    counterpartyName: z
      .string()
      .trim()
      .min(2, "Le nom de la contrepartie est requis.")
      .max(150, "Le nom de la contrepartie est trop long."),

    reason: z
      .string()
      .trim()
      .min(3, "Le motif est requis.")
      .max(1000, "Le motif est trop long."),

    paymentMethod: z
      .string()
      .min(1, "Sélectionnez un moyen de paiement.")
      .pipe(
        z.enum(paymentMethods, {
          error: "Sélectionnez un moyen de paiement valide.",
        }),
      ),

    reference: optionalReference,

    occurredAt: occurredAtSchema,
  })
  .superRefine((data, context) => {
    if (!isCategoryAllowedForType(data.type, data.category)) {
      context.addIssue({
        code: "custom",
        path: ["category"],
        message: "Cette catégorie ne correspond pas au type de mouvement.",
      });
      return;
    }

    const requirement = getProductRequirementForCategory(data.category);

    if (requirement === "required" && !data.product) {
      context.addIssue({
        code: "custom",
        path: ["product"],
        message: "Sélectionnez le produit concerné par le paiement client.",
      });
    }

    if (requirement === "forbidden" && data.product) {
      context.addIssue({
        code: "custom",
        path: ["product"],
        message: "Aucun produit ne doit être associé à cette catégorie.",
      });
    }
  });

export type LedgerEntryFormInput = z.input<typeof financialLedgerEntrySchema>;
export type ValidatedLedgerEntryInput = z.output<
  typeof financialLedgerEntrySchema
>;

export const reverseLedgerEntrySchema = z.object({
  entryId: z
    .string()
    .trim()
    .min(1, "L’écriture financière est requise.")
    .max(100),
  reason: z
    .string()
    .trim()
    .min(3, "Le motif de l’annulation est requis.")
    .max(1000, "Le motif est trop long."),
});

export type ReverseLedgerEntryInput = z.output<
  typeof reverseLedgerEntrySchema
>;
