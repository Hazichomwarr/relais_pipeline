import {
  ArrowDownLeft,
  ArrowUpRight,
  Layers,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { formatXofAmount } from "@/src/lib/financial-ledger-format";
import type { FinancialLedgerSummaryResult } from "@/src/services/financial-ledger.service";

type SummaryCard = {
  label: string;
  value: string;
  helper?: string;
  icon: LucideIcon;
  tone: "neutral" | "positive" | "negative" | "balance";
};

const toneClasses: Record<SummaryCard["tone"], string> = {
  neutral: "bg-slate-100 text-slate-600",
  positive: "bg-emerald-100 text-emerald-600",
  negative: "bg-red-100 text-red-600",
  balance: "bg-blue-100 text-blue-600",
};

/**
 * Every figure here comes straight from the Ticket 17A summary DTO —
 * balance, inflows, outflows, and postedEntryCount are never recomputed
 * or converted to Number() in this component, only formatted.
 */
export default function FinancialSummaryCards({
  summary,
}: {
  summary: FinancialLedgerSummaryResult;
}) {
  const cards: SummaryCard[] = [
    {
      label: "Solde actuel",
      value: formatXofAmount(summary.balance),
      icon: Wallet,
      tone: "balance",
    },
    {
      label: "Entrées",
      value: formatXofAmount(summary.totalInflows),
      icon: ArrowDownLeft,
      tone: "positive",
    },
    {
      label: "Sorties",
      value: formatXofAmount(summary.totalOutflows),
      icon: ArrowUpRight,
      tone: "negative",
    },
    {
      label: "Écritures",
      value: String(summary.postedEntryCount),
      helper: "Actuellement enregistrées, hors écritures annulées",
      icon: Layers,
      tone: "neutral",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <div
            key={card.label}
            className="rounded-3xl border border-slate-200 bg-white p-5"
          >
            <div className="flex items-center gap-4">
              <div
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${toneClasses[card.tone]}`}
              >
                <Icon className="h-6 w-6" aria-hidden="true" />
              </div>

              <div className="min-w-0">
                <p className="text-sm text-slate-500">{card.label}</p>
                <p className="truncate text-2xl font-bold text-slate-900">
                  {card.value}
                </p>
              </div>
            </div>

            {card.helper && (
              <p className="mt-3 text-xs text-slate-400">{card.helper}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
