import type { ProspectConversionOutcome } from "@prisma/client";

import type { SalesWhyOutcomeEntry } from "@/src/services/sales-why-analytics.service-core";
import ReasonRanking from "./ReasonRanking";

const outcomeCopy: Record<ProspectConversionOutcome, { title: string; empty: string }> = {
  ADVANCED: {
    title: "Pourquoi ça avance",
    empty: "Pas encore assez de données structurées sur les opportunités qui avancent.",
  },
  STALLED: {
    title: "Pourquoi ça bloque",
    empty: "Pas encore assez de données structurées sur les opportunités bloquées.",
  },
  WON: {
    title: "Pourquoi nous gagnons",
    empty: "Pas encore assez de données structurées sur les opportunités gagnées.",
  },
  LOST: {
    title: "Pourquoi nous perdons",
    empty: "Pas encore assez de données structurées sur les opportunités perdues.",
  },
};

/**
 * When the page passes all 4 entries (no outcome filter selected), this
 * renders the full 2×2 grid. When the page has already narrowed `byOutcome`
 * to a single entry (a specific Résultat filter selected), it renders just
 * that one card — no redundant empty sections (Ticket 20G).
 */
export default function OutcomeReasonBreakdown({
  byOutcome,
}: {
  byOutcome: SalesWhyOutcomeEntry[];
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {byOutcome.map((entry) => {
        const copy = outcomeCopy[entry.outcome];
        return (
          <ReasonRanking
            key={entry.outcome}
            title={copy.title}
            reasons={entry.reasons}
            emptyMessage={copy.empty}
          />
        );
      })}
    </div>
  );
}
