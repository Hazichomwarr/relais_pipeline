import { ClipboardList } from "lucide-react";

import DailyTaskItem from "@/component/daily-work/DailyTaskItem";
import {
  groupDailyTasksForDisplay,
  type WorkdayDisplayState,
} from "@/src/lib/daily-work-presentation";
import type { DailyTaskRecord } from "@/src/services/daily-task.service-core";

type DailyTaskListProps = {
  tasks: DailyTaskRecord[];
  workdayState: WorkdayDisplayState;
};

/**
 * Ticket 27F §16/§17/§27 — a calm working checklist, always shown
 * (including before the workday starts, per 27A §11/27F §23 — a task
 * may exist before its Workday does), never a desktop data table. Only
 * today's tasks (27F §25/§26): no future/past browsing here.
 */
export default function DailyTaskList({ tasks, workdayState }: DailyTaskListProps) {
  const { active, cancelled, progress } = groupDailyTasksForDisplay(tasks);
  const interactive =
    workdayState === "STARTED_UNCONFIRMED" || workdayState === "STARTED_CONFIRMED";

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-bold text-[#0f2557]">Tâches du jour</h2>
        {progress.total > 0 && (
          <p className="text-sm font-medium text-slate-500">
            {progress.completed} / {progress.total} terminées
          </p>
        )}
      </div>

      {progress.total > 0 && (
        <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{
              width: `${Math.round((progress.completed / progress.total) * 100)}%`,
            }}
          />
        </div>
      )}

      {active.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center">
          <ClipboardList className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" />
          <p className="mt-3 font-semibold text-slate-700">
            Aucune tâche assignée pour aujourd’hui
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
            Votre journée reste ouverte aux nouvelles tâches qui peuvent être
            ajoutées par la Direction.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-3xl border border-slate-200 bg-white">
          {active.map((task) => (
            <DailyTaskItem key={task.id} task={task} interactive={interactive} />
          ))}
        </div>
      )}

      {workdayState === "NOT_STARTED" && active.some((task) => task.status === "OPEN") && (
        <p className="mt-3 text-xs text-slate-400">
          Commencez votre journée pour pouvoir terminer vos tâches.
        </p>
      )}

      {cancelled.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
            Annulées
          </p>
          <div className="divide-y divide-slate-100 overflow-hidden rounded-3xl border border-slate-200 bg-slate-50/60">
            {cancelled.map((task) => (
              <DailyTaskItem key={task.id} task={task} interactive={false} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
