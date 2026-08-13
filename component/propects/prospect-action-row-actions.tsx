"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  cancelProspectActionAction,
  completeProspectActionAction,
} from "@/src/actions/prospect-action.actions";

type ProspectActionRowActionsProps = {
  actionId: string;
  canComplete: boolean;
  canCancel: boolean;
};

export default function ProspectActionRowActions({
  actionId,
  canComplete,
  canCancel,
}: ProspectActionRowActionsProps) {
  const router = useRouter();
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string>();

  if (!canComplete && !canCancel) {
    return null;
  }

  async function handleComplete() {
    setIsPending(true);
    setError(undefined);

    const result = await completeProspectActionAction({ actionId });

    setIsPending(false);

    if (!result.success) {
      setError(result.message);
      return;
    }

    router.refresh();
  }

  async function handleCancel() {
    if (reason.trim().length < 5) {
      setError("Précisez la raison de l’annulation.");
      return;
    }

    setIsPending(true);
    setError(undefined);

    const result = await cancelProspectActionAction({
      actionId,
      cancellationReason: reason,
    });

    setIsPending(false);

    if (!result.success) {
      setError(result.message);
      return;
    }

    router.refresh();
  }

  return (
    <div className="flex w-full shrink-0 flex-col items-end gap-2 sm:w-auto">
      <div className="flex gap-2">
        {canComplete && (
          <button
            type="button"
            onClick={handleComplete}
            disabled={isPending}
            className="h-9 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Terminer
          </button>
        )}
        {canCancel && !showCancelForm && (
          <button
            type="button"
            onClick={() => setShowCancelForm(true)}
            disabled={isPending}
            className="h-9 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Annuler
          </button>
        )}
      </div>

      {showCancelForm && (
        <div className="w-full min-w-[220px] rounded-xl border border-red-200 bg-red-50/60 p-3">
          <textarea
            rows={2}
            placeholder="Raison de l’annulation"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={isPending}
            className="w-full rounded-lg border border-red-200 bg-white px-2 py-2 text-xs text-slate-700 outline-none focus:border-red-400"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowCancelForm(false);
                setReason("");
                setError(undefined);
              }}
              disabled={isPending}
              className="h-8 rounded-lg px-2 text-xs font-semibold text-slate-500 hover:bg-slate-100"
            >
              Retour
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isPending}
              className="h-8 rounded-lg bg-red-600 px-3 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Annulation..." : "Confirmer"}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
