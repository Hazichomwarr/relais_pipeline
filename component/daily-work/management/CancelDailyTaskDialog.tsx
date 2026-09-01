"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { cancelDailyTaskAction } from "@/src/actions/daily-task.actions";

type CancelDailyTaskDialogProps = {
  taskId: string;
  taskContent: string;
};

/**
 * Ticket 27G §42/§43 — cancellation is terminal, so it goes through a
 * confirmation dialog with a required reason, same accessible pattern as
 * every other dialog in this ticket/27F. After success this dialog does
 * not (and cannot) show who cancelled or when — 27D's schema has no
 * cancelledAt/cancelledByUserId; the page simply revalidates to the real
 * "Annulée · Motif : …" row (ManagementTaskItem), never a fabricated one.
 */
export default function CancelDailyTaskDialog({
  taskId,
  taskContent,
}: CancelDailyTaskDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string>();
  const dialogRef = useRef<HTMLDivElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    reasonRef.current?.focus();

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
    setReason("");
    setOpen(true);
  }

  async function handleCancel() {
    if (reason.trim().length === 0) {
      setError("Indiquez la raison de l’annulation.");
      return;
    }

    setIsPending(true);
    setError(undefined);

    const result = await cancelDailyTaskAction({ taskId, cancellationReason: reason });

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
        className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
      >
        Annuler
      </button>

      {open && (
        <div className="safe-top safe-bottom fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 px-4 py-8 backdrop-blur-sm">
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-task-dialog-title"
            aria-describedby="cancel-task-dialog-description"
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
          >
            <h2 id="cancel-task-dialog-title" className="text-xl font-bold text-[#0f2557]">
              Annuler cette tâche ?
            </h2>
            <p id="cancel-task-dialog-description" className="mt-2 break-words text-sm leading-6 text-slate-500">
              « {taskContent} » restera visible dans l’historique de la
              journée, marquée comme annulée.
            </p>

            <label
              htmlFor="cancellation-reason"
              className="mt-4 block text-sm font-semibold text-slate-700"
            >
              Motif de l’annulation
            </label>
            <textarea
              ref={reasonRef}
              id="cancellation-reason"
              rows={2}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={isPending}
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
                Retour
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={isPending}
                className="h-12 w-full rounded-xl bg-red-600 px-5 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {isPending ? "Annulation..." : "Annuler la tâche"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
