import { getStatusLabel } from "@/component/propects/prospect-detail-sections";
import type { PipelineItem } from "@/src/lib/commercial-dashboard-presentation";

/**
 * Ticket 20F: these are mutually-exclusive CURRENT-state buckets, not a
 * shrinking cumulative funnel — the heading and copy must never imply
 * "X% passed from stage to stage", since the CRM does not durably
 * preserve historical stage transitions (only WON's transition is
 * durable, plus LOST since Ticket 20D). All 7 ProspectStatus values are
 * always rendered, even at zero, via buildPipeline.
 */
export default function CurrentPipelineDistribution({
  pipeline,
}: {
  pipeline: PipelineItem[];
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-bold text-[#0f2557]">
        Répartition actuelle du pipeline
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Où se trouvent les prospects de la période en ce moment — pas un taux
        de passage d’une étape à l’autre.
      </p>

      <div className="mt-6 space-y-3">
        {pipeline.map((item) => (
          <div key={item.status}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">
                {getStatusLabel(item.status)}
              </span>
              <span className="text-slate-500">
                {item.count} · {Math.round(item.percentage)}%
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-[#0f2557]"
                style={{ width: `${Math.min(100, item.percentage)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
