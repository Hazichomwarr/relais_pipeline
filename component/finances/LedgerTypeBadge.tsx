import type { LedgerEntryType } from "@prisma/client";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

import { formatXofAmount } from "@/src/lib/financial-ledger-format";

const typeLabels: Record<LedgerEntryType, string> = {
  INFLOW: "Entrée",
  OUTFLOW: "Sortie",
};

const counterpartyLabels: Record<LedgerEntryType, string> = {
  INFLOW: "Reçu de",
  OUTFLOW: "Payé à",
};

export function getLedgerTypeLabel(type: LedgerEntryType): string {
  return typeLabels[type];
}

/**
 * Direction is never conveyed by color alone: every signed amount carries
 * a textual "+"/"-" prefix alongside the "Entrée"/"Sortie" badge label.
 */
export function formatSignedXofAmount(
  type: LedgerEntryType,
  amount: string,
): string {
  const sign = type === "INFLOW" ? "+" : "-";
  return `${sign} ${formatXofAmount(amount)}`;
}

export function getCounterpartyLabel(type: LedgerEntryType): string {
  return counterpartyLabels[type];
}

const toneClasses: Record<LedgerEntryType, string> = {
  INFLOW: "bg-emerald-100 text-emerald-700",
  OUTFLOW: "bg-red-100 text-red-700",
};

export default function LedgerTypeBadge({ type }: { type: LedgerEntryType }) {
  const Icon = type === "INFLOW" ? ArrowDownLeft : ArrowUpRight;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${toneClasses[type]}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {typeLabels[type]}
    </span>
  );
}
