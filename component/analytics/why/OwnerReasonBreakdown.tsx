import { getConversionReasonLabel } from "@/src/lib/prospect-conversion-options";
import type { SalesWhyOwnerEntry } from "@/src/services/sales-why-analytics.service-core";

/**
 * Ticket 20G: alphabetical by ownerName (see the core's sort), never by
 * volume or "conversion quality" — this is diagnostic visibility, not a
 * commercial leaderboard.
 */
export default function OwnerReasonBreakdown({
  byOwner,
}: {
  byOwner: SalesWhyOwnerEntry[];
}) {
  if (byOwner.length === 0) {
    return null;
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-bold text-[#0f2557]">Raisons par commercial</h2>
      <p className="mt-1 text-sm text-slate-500">
        Chaque suivi reste attribué au commercial responsable du prospect au
        moment de ce résultat, même après une réaffectation ultérieure.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {byOwner.map((entry) => (
          <div key={entry.ownerUserId ?? "unassigned"} className="rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900">{entry.ownerName}</h3>
              <span className="text-sm text-slate-500">
                {entry.total} suivi{entry.total > 1 ? "s" : ""}
              </span>
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Principales raisons
            </p>
            <ul className="mt-1.5 space-y-1 text-sm text-slate-600">
              {entry.topReasons.map((reason) => (
                <li key={reason.reason}>
                  {getConversionReasonLabel(reason.reason)} — {reason.count}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
