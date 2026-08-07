"use client";

import { AlertTriangle, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { reverseLedgerEntryAction } from "@/src/actions/financial-ledger.actions";

/**
 * ADMIN-only in the UI; the Server Action re-checks requireAdmin() itself
 * (Ticket 17A), so this component never has to be the last line of
 * defense — hiding the trigger is purely UX, not the security boundary.
 */
export default function ReverseLedgerEntryForm({
  entryId,
}: {
  entryId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState(false);
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

  async function confirmReversal() {
    setIsPending(true);
    setError(undefined);

    const result = await reverseLedgerEntryAction({ entryId, reason });

    if (!result.success) {
      setIsPending(false);
      setError(result.message);
      return;
    }

    setOpen(false);
    setIsPending(false);
    setSuccess(true);
    router.refresh();
  }

  return (
    <>
      {success && (
        <div
          role="status"
          className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
        >
          L’écriture a été annulée et le solde a été corrigé.
        </div>
      )}

      <button
        type="button"
        onClick={openDialog}
        className="flex h-12 items-center justify-center gap-2 rounded-xl border border-red-200 px-5 font-semibold text-red-600 transition hover:bg-red-50"
      >
        <Undo2 className="h-4 w-4" />
        Annuler cette écriture
      </button>

      {open && (
        <div className="safe-top safe-bottom fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 px-4 py-8 backdrop-blur-sm">
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reverse-entry-dialog-title"
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h2
                  id="reverse-entry-dialog-title"
                  className="text-xl font-bold text-[#0f2557]"
                >
                  Annuler cette écriture financière ?
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  L’écriture originale restera dans l’historique et une
                  écriture inverse sera créée pour corriger le solde.
                </p>
              </div>
            </div>

            <label className="mt-5 block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Motif de l’annulation
              </span>
              <textarea
                rows={3}
                placeholder="Ex : Montant enregistré par erreur"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                disabled={isPending}
                className="min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-[#0f2557] focus:ring-4 focus:ring-blue-100"
              />
            </label>

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
                className="h-12 rounded-xl border border-slate-200 px-5 font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmReversal}
                disabled={isPending || reason.trim().length < 3}
                className="h-12 rounded-xl bg-red-600 px-5 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "Annulation..." : "Confirmer l’annulation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
