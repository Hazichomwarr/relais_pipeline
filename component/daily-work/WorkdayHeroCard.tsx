import { CheckCircle2, Clock } from "lucide-react";

import EndWorkdayDialog from "@/component/daily-work/EndWorkdayDialog";
import StartWorkdayButton from "@/component/daily-work/StartWorkdayButton";
import { formatDailyReportTime } from "@/src/lib/daily-report-date";
import {
  formatMinutesAsTime,
  resolveWorkdayDisplayState,
} from "@/src/lib/daily-work-presentation";
import {
  DEFAULT_WORKDAY_EXPECTED_END_MINUTES,
  DEFAULT_WORKDAY_EXPECTED_START_MINUTES,
  type WorkdayRecord,
} from "@/src/services/workday.service-core";

type WorkdayHeroCardProps = {
  workday: WorkdayRecord | null;
  openTaskCount: number;
};

/**
 * Ticket 27F §6-15 — the strongest visual element on the page, one
 * visual system with state-specific content rather than five unrelated
 * layouts. Derives display state purely from the timestamp tuple (27A
 * §12.1) — there is no persisted Workday status to read. No lateness
 * judgment (§15), no worked-duration arithmetic (§13): startedAt/endedAt
 * are declarations, not proof of labor, and the UI never overstates them.
 */
export default function WorkdayHeroCard({ workday, openTaskCount }: WorkdayHeroCardProps) {
  const state = resolveWorkdayDisplayState(workday);

  const expectedStart = formatMinutesAsTime(
    workday?.expectedStartTime ?? DEFAULT_WORKDAY_EXPECTED_START_MINUTES,
  );
  const expectedEnd = formatMinutesAsTime(
    workday?.expectedEndTime ?? DEFAULT_WORKDAY_EXPECTED_END_MINUTES,
  );

  return (
    <div className="rounded-4xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
      {state === "NOT_STARTED" && (
        <div>
          <p className="text-2xl font-bold text-[#0f2557] sm:text-3xl">
            Prêt pour aujourd’hui ?
          </p>
          <p className="mt-2 text-slate-500">
            Commencez votre journée lorsque vous êtes prêt à démarrer.
          </p>

          <div className="mt-6">
            <StartWorkdayButton />
          </div>
        </div>
      )}

      {(state === "STARTED_UNCONFIRMED" || state === "STARTED_CONFIRMED") && workday && (
        <div>
          <p className="text-2xl font-bold text-[#0f2557] sm:text-3xl">
            Journée en cours
          </p>
          <p className="mt-2 text-slate-500">
            Début · <span className="font-semibold text-slate-700">{formatDailyReportTime(workday.startedAt)}</span>
          </p>

          <div className="mt-4">
            {state === "STARTED_CONFIRMED" && workday.confirmedAt ? (
              <p className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Présence confirmée à {formatDailyReportTime(workday.confirmedAt)}
              </p>
            ) : (
              <div>
                <p className="inline-flex items-center rounded-full bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700">
                  En attente de confirmation
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  Votre début de journée n’a pas encore été confirmé.
                </p>
              </div>
            )}
          </div>

          <div className="mt-8">
            <EndWorkdayDialog openTaskCount={openTaskCount} />
          </div>
        </div>
      )}

      {(state === "ENDED_UNCONFIRMED" || state === "ENDED_CONFIRMED") && workday?.endedAt && (
        <div>
          <p className="text-2xl font-bold text-slate-500 sm:text-3xl">
            Journée terminée
          </p>
          <p className="mt-2 font-semibold text-slate-700">
            {formatDailyReportTime(workday.startedAt)} — {formatDailyReportTime(workday.endedAt)}
          </p>

          <div className="mt-4">
            {state === "ENDED_CONFIRMED" && workday.confirmedAt ? (
              <p className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Présence confirmée à {formatDailyReportTime(workday.confirmedAt)}
              </p>
            ) : (
              <p className="inline-flex items-center rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-500">
                Confirmation en attente
              </p>
            )}
          </div>
        </div>
      )}

      <div className="mt-8 flex items-center gap-2 border-t border-slate-100 pt-6 text-sm text-slate-400">
        <Clock className="h-4 w-4" aria-hidden="true" />
        <span>
          Horaire prévu · {expectedStart} — {expectedEnd}
        </span>
      </div>
    </div>
  );
}
