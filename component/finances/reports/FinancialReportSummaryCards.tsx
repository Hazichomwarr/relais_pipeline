import { ArrowDownLeft, ArrowUpRight, Layers, Scale } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import FinancialComparisonIndicator from "@/component/finances/reports/FinancialComparisonIndicator";
import { formatXofAmount } from "@/src/lib/financial-ledger-format";
import type {
  FinancialReportComparisonDto,
  FinancialReportSummaryDto,
} from "@/src/services/financial-report.service-core";

const toneClasses = {
  neutral: "bg-slate-100 text-slate-600",
  positive: "bg-emerald-100 text-emerald-600",
  negative: "bg-red-100 text-red-600",
  balance: "bg-blue-100 text-blue-600",
} as const;

/**
 * Every figure comes straight from the report DTO — inflows, outflows,
 * net, entryCount, and the comparison percentages are never recomputed
 * or Number()-converted here, only formatted.
 */
export default function FinancialReportSummaryCards({
  summary,
  comparison,
}: {
  summary: FinancialReportSummaryDto;
  comparison: FinancialReportComparisonDto;
}) {
  const cards: {
    label: string;
    value: string;
    icon: LucideIcon;
    tone: keyof typeof toneClasses;
    comparison?: { changePercent: string | null; tone: "revenue" | "expense" };
  }[] = [
    {
      label: "Entrées",
      value: formatXofAmount(summary.inflows),
      icon: ArrowDownLeft,
      tone: "positive",
      comparison: {
        changePercent: comparison.inflowChangePercent,
        tone: "revenue",
      },
    },
    {
      label: "Sorties",
      value: formatXofAmount(summary.outflows),
      icon: ArrowUpRight,
      tone: "negative",
      comparison: {
        changePercent: comparison.outflowChangePercent,
        tone: "expense",
      },
    },
    {
      label: "Mouvement net",
      value: formatXofAmount(summary.net),
      icon: Scale,
      tone: "balance",
      comparison: {
        changePercent: comparison.netChangePercent,
        tone: "revenue",
      },
    },
    {
      label: "Écritures",
      value: String(summary.entryCount),
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

            {card.comparison && (
              <FinancialComparisonIndicator
                changePercent={card.comparison.changePercent}
                tone={card.comparison.tone}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
