"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { assignDailyTaskAction } from "@/src/actions/daily-task.actions";
import { formatBusinessIsoDate } from "@/src/lib/financial-report-period";

type AssignDailyTaskDialogProps = {
  assignedToUserId: string;
  agentName: string;
  workDate: Date;
};

/**
 * Ticket 27G §33/§34/§37 — one field only (content — the domain has no
 * title/description/priority split), today's business date only (no date
 * picker, even though the backend supports future dates — 27G is a
 * today-only workspace by product decision). Same accessible hand-rolled
 * dialog pattern as 27F's EndWorkdayDialog.
 */
export default function AssignDailyTaskDialog({
  assignedToUserId,
  agentName,
  workDate,
}: AssignDailyTaskDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string>();
  const dialogRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    contentRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        "button:not([disabled]), textarea:not([disabled])",
      );

      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function openDialog() {
    setError(undefined);
    setContent("");
    setOpen(true);
  }

  async function handleAssign() {
    if (content.trim().length === 0) {
      setError("Décrivez la tâche à assigner.");
      return;
    }

    setIsPending(true);
    setError(undefined);

    const result = await assignDailyTaskAction({
      assignedToUserId,
      workDate: formatBusinessIsoDate(workDate),
      content,
    });

    if (!result.success) {
      setIsPending(false);
      setError(result.message);
      return;
    }

    setOpen(false);
    setIsPending(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Assigner une tâche
      </button>

      {open && (
        <div className="safe-top safe-bottom fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 px-4 py-8 backdrop-blur-sm">
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="assign-task-dialog-title"
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
          >
            <h2 id="assign-task-dialog-title" className="text-xl font-bold text-[#0f2557]">
              Assigner une tâche
            </h2>

            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-slate-500">Agent</span>
              <span className="font-semibold text-slate-700">{agentName}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="text-slate-500">Date</span>
              <span className="font-semibold text-slate-700">Aujourd’hui</span>
            </div>

            <label
              htmlFor="daily-task-content"
              className="mt-4 block text-sm font-semibold text-slate-700"
            >
              Tâche
            </label>
            <textarea
              ref={contentRef}
              id="daily-task-content"
              rows={3}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              disabled={isPending}
              placeholder="Relancer les établissements qui ont demandé une deuxième démonstration…"
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-[#0f2557] focus:ring-4 focus:ring-blue-100"
            />

            {error && (
              <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="h-12 w-full rounded-xl border border-slate-200 px-5 font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 sm:w-auto"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleAssign}
                disabled={isPending}
                className="h-12 w-full rounded-xl bg-[#0f2557] px-5 font-semibold text-white transition hover:bg-[#18366f] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {isPending ? "Attribution..." : "Assigner"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
