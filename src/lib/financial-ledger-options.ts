import type {
  LedgerEntryCategory,
  LedgerEntryType,
  PaymentMethod,
  RelaisProduct,
} from "@prisma/client";

export const inflowCategoryOptions = [
  { value: "CLIENT_PAYMENT", label: "Paiement client" },
  { value: "CAPITAL_CONTRIBUTION", label: "Apport en capital" },
  { value: "LOAN_RECEIVED", label: "Prêt reçu" },
  { value: "REFUND_RECEIVED", label: "Remboursement reçu" },
  { value: "OTHER_INFLOW", label: "Autre entrée" },
] as const satisfies readonly { value: LedgerEntryCategory; label: string }[];

export const outflowCategoryOptions = [
  { value: "SALARY", label: "Salaire" },
  { value: "TRANSPORT", label: "Transport" },
  { value: "FUEL", label: "Carburant" },
  { value: "PRINTING", label: "Impression" },
  { value: "INTERNET", label: "Internet et communication" },
  { value: "OFFICE_SUPPLIES", label: "Fournitures de bureau" },
  { value: "EQUIPMENT", label: "Équipement" },
  { value: "TAXES_AND_FEES", label: "Taxes et frais" },
  { value: "CLIENT_REFUND", label: "Remboursement client" },
  { value: "OTHER_OUTFLOW", label: "Autre sortie" },
] as const satisfies readonly { value: LedgerEntryCategory; label: string }[];

export const paymentMethodOptions = [
  { value: "CASH", label: "Espèces" },
  { value: "BANK_TRANSFER", label: "Virement bancaire" },
  { value: "MOBILE_MONEY", label: "Mobile Money" },
  { value: "CARD", label: "Carte" },
  { value: "CHECK", label: "Chèque" },
  { value: "OTHER", label: "Autre" },
] as const satisfies readonly { value: PaymentMethod; label: string }[];

export type InflowCategory = (typeof inflowCategoryOptions)[number]["value"];
export type OutflowCategory = (typeof outflowCategoryOptions)[number]["value"];

const inflowCategorySet = new Set<LedgerEntryCategory>(
  inflowCategoryOptions.map((option) => option.value),
);
const outflowCategorySet = new Set<LedgerEntryCategory>(
  outflowCategoryOptions.map((option) => option.value),
);

const categoryLabelByValue = new Map<LedgerEntryCategory, string>(
  [...inflowCategoryOptions, ...outflowCategoryOptions].map((option) => [
    option.value,
    option.label,
  ]),
);

const paymentMethodLabelByValue = new Map<PaymentMethod, string>(
  paymentMethodOptions.map((option) => [option.value, option.label]),
);

export function isInflowCategory(category: LedgerEntryCategory): boolean {
  return inflowCategorySet.has(category);
}

export function isOutflowCategory(category: LedgerEntryCategory): boolean {
  return outflowCategorySet.has(category);
}

/**
 * Server-side gate: INFLOW entries may only use inflow categories, and
 * OUTFLOW entries may only use outflow categories.
 */
export function isCategoryAllowedForType(
  type: LedgerEntryType,
  category: LedgerEntryCategory,
): boolean {
  return type === "INFLOW"
    ? isInflowCategory(category)
    : isOutflowCategory(category);
}

export function getLedgerEntryCategoryLabel(
  category: LedgerEntryCategory,
): string {
  return categoryLabelByValue.get(category) ?? category;
}

export function getPaymentMethodLabel(method: PaymentMethod): string {
  return paymentMethodLabelByValue.get(method) ?? method;
}

export type ProductRequirement = "required" | "optional" | "forbidden";

/**
 * CLIENT_PAYMENT always names a RELAIS product; CLIENT_REFUND may but
 * doesn't have to (a refund can be unrelated to a specific product sale);
 * every other category is product-agnostic (salaries, fuel, capital, …)
 * and must never carry one — this keeps category and product identity
 * separate (see Ticket 17A: "Do not create categories such as
 * KARMDA_PAYMENT...").
 */
export function getProductRequirementForCategory(
  category: LedgerEntryCategory,
): ProductRequirement {
  if (category === "CLIENT_PAYMENT") {
    return "required";
  }

  if (category === "CLIENT_REFUND") {
    return "optional";
  }

  return "forbidden";
}

export function isProductValidForCategory(
  category: LedgerEntryCategory,
  product: RelaisProduct | null | undefined,
): boolean {
  const requirement = getProductRequirementForCategory(category);

  if (requirement === "required") {
    return product != null;
  }

  if (requirement === "forbidden") {
    return product == null;
  }

  return true;
}
