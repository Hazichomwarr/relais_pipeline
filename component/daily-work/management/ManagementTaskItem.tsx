import { Circle, CircleCheck } from "lucide-react";

import CancelDailyTaskDialog from "@/component/daily-work/management/CancelDailyTaskDialog";
import { formatDailyReportTime } from "@/src/lib/daily-report-date";
import type { DailyWorkManagementTask } from "@/src/services/daily-work-management.service";

type ManagementTaskItemProps = {
  task: DailyWorkManagementTask;
};

/**
 * Ticket 27G §29/§30/§43/§44 — management needs provenance (assignor
 * name, French status wording — "À faire"/"Terminée"/"Annulée", never
 * raw enum values), and the cancellation CTA only where canCancel is
 * already true (27E's real canCancelTask, resolved server-side by the
 * read composition). A cancelled task shows only its durable reason —
 * never a fabricated cancelledAt/cancelledByUserId, which 27D's schema
 * does not have.
 */
export default function ManagementTaskItem({ task }: ManagementTaskItemProps) {
  if (task.status === "CANCELLED") {
    return (
      <div className="flex items-start gap-3 px-4 py-3 opacity-60">
        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-slate-300" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm text-slate-500 line-through decoration-slate-300">
            {task.content}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Annulée · Assignée par {task.assignedByName}
            {task.cancellationReason ? ` · Motif : ${task.cancellationReason}` : ""}
          </p>
        </div>
      </div>
    );
  }

  const completed = task.status === "COMPLETED";

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span className="mt-0.5 shrink-0 text-slate-400">
        {completed ? (
          <CircleCheck className="h-5 w-5 text-emerald-500" aria-hidden="true" />
        ) : (
          <Circle className="h-5 w-5" aria-hidden="true" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={`break-words text-sm font-medium ${
            completed ? "text-slate-500 line-through decoration-slate-300" : "text-slate-800"
          }`}
        >
          {task.content}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          {completed ? "Terminée" : "À faire"} · Assignée par {task.assignedByName} à{" "}
          {formatDailyReportTime(task.assignedAt)}
        </p>
      </div>
      {task.canCancel && (
        <div className="shrink-0">
          <CancelDailyTaskDialog taskId={task.id} taskContent={task.content} />
        </div>
      )}
    </div>
  );
}
