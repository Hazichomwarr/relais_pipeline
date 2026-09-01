import DailyTaskCompletionToggle from "@/component/daily-work/DailyTaskCompletionToggle";
import { formatDailyReportTime } from "@/src/lib/daily-report-date";
import type { DailyTaskRecord } from "@/src/services/daily-task.service-core";

type DailyTaskItemProps = {
  task: DailyTaskRecord;
  /** Whether completion/uncompletion is currently allowed — false before Start (27F §23) and after End (27F §24). */
  interactive: boolean;
};

/**
 * Ticket 27F §18/§55 — a working checklist row, not an administrative
 * table row. Cancelled tasks (27F §45) render in a visibly subdued
 * treatment with their durable cancellationReason, but never a toggle —
 * there is nothing to complete/uncomplete on withdrawn work. Long
 * content wraps naturally (break-words) rather than clipping or pushing
 * the completion control out of reach.
 */
export default function DailyTaskItem({ task, interactive }: DailyTaskItemProps) {
  if (task.status === "CANCELLED") {
    return (
      <div className="flex items-start gap-4 px-5 py-4 opacity-60">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="break-words text-slate-500 line-through decoration-slate-300">
            {task.content}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Tâche annulée
            {task.cancellationReason ? ` · Motif : ${task.cancellationReason}` : ""}
          </p>
        </div>
      </div>
    );
  }

  const completed = task.status === "COMPLETED";

  return (
    <div className="flex items-start gap-4 px-5 py-4">
      <DailyTaskCompletionToggle
        taskId={task.id}
        content={task.content}
        completed={completed}
        disabled={!interactive}
      />
      <div className="min-w-0 flex-1 pt-2">
        <p
          className={`break-words font-medium ${
            completed ? "text-slate-500 line-through decoration-slate-300" : "text-slate-800"
          }`}
        >
          {task.content}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          {completed
            ? `Terminée à ${formatDailyReportTime(task.completedAt ?? task.assignedAt)}`
            : `Assignée aujourd’hui à ${formatDailyReportTime(task.assignedAt)}`}
        </p>
      </div>
    </div>
  );
}
