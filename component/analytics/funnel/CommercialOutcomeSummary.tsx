import { ArrowUpRight, Ban, Trophy, XCircle } from "lucide-react";

import type { SalesFunnelOutcomeSummary } from "@/src/services/sales-funnel-analytics.service-core";

/**
 * Ticket 20F: these counts come from structured FOLLOW_UP activities
 * (Ticket 20D) whose conversionOutcome is set — never legacy activities
 * with conversionOutcome = null, which are excluded rather than
 * classified as anything. Wording must say "follow-ups whose outcome
 * was X", never "N prospects reached the next stage" — ADVANCED does not
 * imply Prospect.status changed.
 */
export default function CommercialOutcomeSummary({
  outcomes,
}: {
  outcomes: SalesFunnelOutcomeSummary;
}) {
  const cards = [
    { label: "A avancé", value: outcomes.advanced, icon: ArrowUpRight, tone: "bg-blue-100 text-blue-700" },
    { label: "Bloqué", value: outcomes.stalled, icon: Ban, tone: "bg-amber-100 text-amber-700" },
    { label: "Gagné", value: outcomes.won, icon: Trophy, tone: "bg-emerald-100 text-emerald-700" },
    { label: "Perdu", value: outcomes.lost, icon: XCircle, tone: "bg-red-100 text-red-700" },
  ];

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-bold text-[#0f2557]">Mouvements commerciaux</h2>
      <p className="mt-1 text-sm text-slate-500">
        Résultats des suivis structurés enregistrés sur la période.
      </p>

      {outcomes.structuredFollowUps === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-center text-sm text-slate-500">
          Aucun résultat commercial structuré pour cette période.
        </p>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {cards.map((card) => {
            const Icon = card.icon;

            return (
              <div
                key={card.label}
                className="rounded-2xl border border-slate-200 p-4 text-center"
              >
                <div
                  className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full ${card.tone}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <p className="mt-2 text-2xl font-bold text-[#0f2557]">{card.value}</p>
                <p className="text-xs text-slate-500">{card.label}</p>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-400">
        Les analyses de mouvements reposent sur les suivis structurés
        enregistrés depuis l’activation du nouveau workflow de suivi.
      </p>
    </section>
  );
}
