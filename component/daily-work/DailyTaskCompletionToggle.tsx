"use client";

import { Circle, CircleCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  completeMyDailyTaskAction,
  uncompleteMyDailyTaskAction,
} from "@/src/actions/daily-task.actions";

type DailyTaskCompletionToggleProps = {
  taskId: string;
  content: string;
  completed: boolean;
  /** Disabled before Start (27F §23) and after End (27F §24) — this component never decides that itself; the parent passes the truth down from the current Workday state. */
  disabled: boolean;
};

/**
 * Ticket 27F §19-22 — a single, large (44px-ish) touch target with a
 * compact check indicator, not a tiny native checkbox. Uses the real
 * 27E actions (never service-core directly). On a lost concurrency race
 * (e.g. the Workday ended, or another transition already won), the
 * service's own precise French message (27E's error taxonomy already
 * produces one — "Cette tâche est déjà terminée.", "Cette tâche a été
 * annulée.", etc.) is shown, then the page refreshes to the authoritative
 * state — no raw code is ever surfaced.
 */
export default function DailyTaskCompletionToggle({
  taskId,
  content,
  completed,
  disabled,
}: DailyTaskCompletionToggleProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string>();

  async function handleToggle() {
    setIsPending(true);
    setError(undefined);

    const result = completed
      ? await uncompleteMyDailyTaskAction({ taskId })
      : await completeMyDailyTaskAction({ taskId });

    setIsPending(false);

    if (!result.success) {
      setError(result.message);
      router.refresh();
      return;
    }

    router.refresh();
  }

  const label = completed
    ? `Marquer « ${content} » comme non terminée`
    : `Marquer « ${content} » comme terminée`;

  return (
    <div>
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled || isPending}
        aria-pressed={completed}
        aria-label={label}
        title={label}
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-50 ${
          completed
            ? "border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
            : "border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-500"
        }`}
      >
        {completed ? (
          <CircleCheck className="h-6 w-6" aria-hidden="true" />
        ) : (
          <Circle className="h-6 w-6" aria-hidden="true" />
        )}
      </button>

      {error && (
        <p role="alert" className="mt-1 max-w-[10rem] text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
