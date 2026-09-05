import type { SalesFunnelOwnerBreakdown } from "@/src/services/sales-funnel-analytics.service-core";

/**
 * Ticket 20F: ordered alphabetically by ownerName (see the core's sort),
 * never by volume — this list is management visibility, not a
 * leaderboard. No ranking numbers, no "#1"/performance framing.
 */
export default function OwnerPipelineBreakdown({
  byOwner,
}: {
  byOwner: SalesFunnelOwnerBreakdown[];
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-bold text-[#0f2557]">Par commercial</h2>
      <p className="mt-1 text-sm text-slate-500">
        Le total et les étapes en cours reflètent le portefeuille actuel de
        chaque commercial. Les gagnés et perdus restent attribués au
        commercial responsable au moment du résultat, même après une
        réaffectation ultérieure.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {byOwner.map((entry) => (
          <div
            key={entry.ownerUserId ?? "unassigned"}
            className="rounded-2xl border border-slate-200 p-5"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900">{entry.ownerName}</h3>
              <span className="text-sm text-slate-500">
                {entry.total} prospect{entry.total > 1 ? "s" : ""}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500 sm:grid-cols-3">
              <span>Intéressés {entry.interested}</span>
              <span>Qualifiés {entry.qualified}</span>
              <span>Propositions {entry.proposalSent}</span>
              <span>Gagnés {entry.won}</span>
              <span>Perdus {entry.lost}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
