import Link from "next/link";

import { getProductLabel, getStatusLabel } from "@/component/propects/prospect-detail-sections";
import ProspectActionRowActions from "@/component/propects/prospect-action-row-actions";
import { formatDailyReportTime } from "@/src/lib/daily-report-date";
import {
  formatProspectActionQueueDueLabel,
  type ProspectActionQueueBucket,
  type ProspectActionQueueItem,
} from "@/src/services/prospect-action-queue.service-core";

const BUCKET_SECTIONS: Array<{ bucket: ProspectActionQueueBucket; title: string }> = [
  { bucket: "OVERDUE", title: "En retard" },
  { bucket: "TODAY", title: "Aujourd’hui" },
  { bucket: "UPCOMING", title: "À venir" },
];

export default function ProspectActionQueueList({
  items,
  hasActiveFilters,
}: {
  items: ProspectActionQueueItem[];
  hasActiveFilters: boolean;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
        {hasActiveFilters ? (
          <>
            <p className="font-semibold text-slate-700">
              Aucune action ne correspond à ces filtres.
            </p>
            <Link
              href="/actions"
              className="mt-4 inline-block rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Réinitialiser les filtres
            </Link>
          </>
        ) : (
          <>
            <p className="font-semibold text-slate-700">
              Aucune action en attente.
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Les prochaines actions créées lors des suivis apparaîtront ici.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {BUCKET_SECTIONS.map(({ bucket, title }) => {
        const bucketItems = items.filter((item) => item.bucket === bucket);

        if (bucketItems.length === 0) {
          return null;
        }

        return (
          <div key={bucket}>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              {title}
            </p>
            <ul className="space-y-3">
              {bucketItems.map((item) => (
                <li
                  key={item.id}
                  className="rounded-3xl border border-slate-200 bg-white p-5"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900">{item.title}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {item.prospect.name}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {getProductLabel(item.prospect.product)} ·{" "}
                        {getStatusLabel(item.prospect.status)}
                      </p>
                      <p className="mt-3 text-xs text-slate-500">
                        Responsable : {item.assignedTo.name}
                        {!item.assignedTo.active && (
                          <span className="ml-2 font-semibold text-amber-600">
                            Responsable inactif
                          </span>
                        )}
                      </p>
                      <p
                        className={`mt-1 text-sm font-semibold ${
                          bucket === "OVERDUE" ? "text-red-600" : "text-slate-700"
                        }`}
                      >
                        {formatProspectActionQueueDueLabel(item.dueAt)} ·{" "}
                        {formatDailyReportTime(item.dueAt)}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      {item.prospectHref && (
                        <Link
                          href={item.prospectHref}
                          className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold leading-9 text-slate-600 transition hover:bg-slate-50"
                        >
                          Voir le prospect
                        </Link>
                      )}
                      <ProspectActionRowActions
                        actionId={item.id}
                        canComplete={item.canComplete}
                        canCancel={item.canCancel}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
