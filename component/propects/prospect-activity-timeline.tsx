import type { ProspectActivity, ProspectActivityType } from "@prisma/client";
import {
  CalendarCheck2,
  FileCheck2,
  Footprints,
  MessageCircle,
  MonitorPlay,
  NotebookPen,
  Phone,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";

import { prospectActivityTypeOptions } from "@/src/lib/constants/prospect-activity-options";

type ProspectActivityTimelineProps = {
  activities: ProspectActivity[];
  errorMessage?: string;
};

const activityIcons: Record<ProspectActivityType, LucideIcon> = {
  FIELD_VISIT: Footprints,
  PHONE_CALL: Phone,
  WHATSAPP: MessageCircle,
  MEETING: CalendarCheck2,
  DEMO: MonitorPlay,
  DOCUMENT_SENT: FileCheck2,
  FOLLOW_UP: RefreshCw,
  INTERNAL_NOTE: NotebookPen,
};

export default function ProspectActivityTimeline({
  activities,
  errorMessage,
}: ProspectActivityTimelineProps) {
  return (
    <section className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm md:p-7">
      <div className="mb-7">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
          Historique append-only
        </p>
        <h2 className="mt-2 text-2xl font-bold text-[#0f2557]">
          Historique des interactions
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Les interactions supplémentaires sont affichées de la plus récente à
          la plus ancienne.
        </p>
      </div>

      {errorMessage ? (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700"
        >
          {errorMessage}
        </div>
      ) : activities.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-9 text-center">
          <p className="font-semibold text-slate-700">
            Aucune interaction supplémentaire enregistrée.
          </p>
          <p className="mt-2 text-sm text-slate-500">
            L’observation initiale du terrain reste disponible ci-dessus.
          </p>
        </div>
      ) : (
        <ol className="space-y-0">
          {activities.map((activity, index) => {
            const Icon = activityIcons[activity.type];

            return (
              <li key={activity.id} className="relative flex gap-4 pb-8 last:pb-0">
                {index < activities.length - 1 && (
                  <span className="absolute left-5 top-11 h-[calc(100%-2.25rem)] w-px bg-slate-200" />
                )}

                <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 ring-4 ring-white">
                  <Icon className="h-5 w-5" />
                </div>

                <article className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-[#fafbff] p-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-blue-600">
                        {getActivityTypeLabel(activity.type)}
                      </p>
                      <h3 className="mt-2 font-bold leading-6 text-slate-900">
                        {activity.summary}
                      </h3>
                    </div>
                    <time
                      dateTime={activity.occurredAt.toISOString()}
                      className="shrink-0 text-xs font-medium text-slate-500"
                    >
                      {formatOccurredAt(activity.occurredAt)}
                    </time>
                  </div>

                  {activity.details && (
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                      {activity.details}
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-200 pt-3 text-xs text-slate-400">
                    <span>
                      Par {activity.agentName ?? "Commercial non renseigné"}
                    </span>
                    <span>Saisi le {formatCreatedAt(activity.createdAt)}</span>
                  </div>
                </article>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function getActivityTypeLabel(type: ProspectActivityType) {
  return (
    prospectActivityTypeOptions.find((option) => option.value === type)?.label ??
    type
  );
}

function formatOccurredAt(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatCreatedAt(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}
