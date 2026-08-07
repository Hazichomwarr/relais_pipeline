import type { RelaisProduct } from "@prisma/client";

const productLabels: Record<RelaisProduct, string> = {
  KARMDA: "KARMDA",
  LOKARI: "LOKARI",
  NIA: "NIA",
  DIGITAL_SERVICES: "Services digitaux",
};

export function getRelaisProductLabel(product: RelaisProduct): string {
  return productLabels[product];
}

/** "06 août 2026" — the actual transaction date, never createdAt. */
export function formatLedgerOccurredDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}
