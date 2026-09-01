"use client";

import { Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { endMyWorkdayAction } from "@/src/actions/workday.actions";

type EndWorkdayDialogProps = {
  /** Count of still-OPEN tasks (cancelled tasks are not "remaining work" — 27A §47). Purely informational (27A §48): ending is never blocked by open tasks. */
  openTaskCount: number;
};

/**
 * Ticket 27F §10/§11 — deliberately more restrained than Start: an
 * outline/secondary trigger, and ending is materially more consequential
 * than checking off a task, so it goes through a confirmation dialog
 * first. Same accessible-dialog pattern as PersonalNoteDeleteButton
 * (focus trap, Escape to close, body scroll lock) — the established
 * convention in this codebase, since no dialog library is used anywhere.
 */
export default function EndWorkdayDialog({ openTaskCount }: EndWorkdayDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string>();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelButtonRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        "button:not([disabled])",
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
    setOpen(true);
  }

  async function confirmEnd() {
    setIsPending(true);
    setError(undefined);

    const result = await endMyWorkdayAction();

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
        <Square className="h-4 w-4" aria-hidden="true" />
        Terminer ma journée
      </button>

      {open && (
        <div className="safe-top safe-bottom fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 px-4 py-8 backdrop-blur-sm">
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="end-workday-dialog-title"
            aria-describedby="end-workday-dialog-description"
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
          >
            <h2
              id="end-workday-dialog-title"
              className="text-xl font-bold text-[#0f2557]"
            >
              Terminer votre journée ?
            </h2>
            <p
              id="end-workday-dialog-description"
              className="mt-2 text-sm leading-6 text-slate-500"
            >
              {openTaskCount > 0
                ? `${openTaskCount} tâche${openTaskCount > 1 ? "s" : ""} ${
                    openTaskCount > 1 ? "sont" : "est"
                  } encore ouverte${openTaskCount > 1 ? "s" : ""}. Vous pourrez toujours les consulter, mais leur état ne pourra plus être modifié après la fin de la journée.`
                : "Une fois terminée, vous ne pourrez plus modifier l’état de vos tâches pour aujourd’hui."}
            </p>

            {error && (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                ref={cancelButtonRef}
                type="button"
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="h-12 w-full rounded-xl border border-slate-200 px-5 font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 sm:w-auto"
              >
                {openTaskCount > 0 ? "Continuer ma journée" : "Annuler"}
              </button>
              <button
                type="button"
                onClick={confirmEnd}
                disabled={isPending}
                className="h-12 w-full rounded-xl bg-[#0f2557] px-5 font-semibold text-white transition hover:bg-[#18366f] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {isPending
                  ? "Fin de journée..."
                  : openTaskCount > 0
                    ? "Terminer quand même"
                    : "Terminer ma journée"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
