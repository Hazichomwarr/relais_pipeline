"use client";

import type { UserRole } from "@prisma/client";
import { ArrowRightLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { reassignProspectAction } from "@/src/actions/prospect-assignment-transfer.actions";
import { getUserRoleLabel } from "@/src/lib/constants/user-options";
import { resolveReassignProspectErrorPresentation } from "@/src/lib/reassign-prospect-error-presentation";

type EligibleUser = {
  id: string;
  firstName: string;
  lastName: string;
  role: UserRole;
};

type ReassignProspectDialogProps = {
  prospectId: string;
  currentAssigneeId: string | null;
  currentAssigneeName: string | null;
  eligibleUsers: EligibleUser[];
};

/**
 * Ticket 28C — the sole UI entry point for changing a prospect's current
 * responsible user. Calls the existing 28B reassignProspectAction
 * directly; this file never writes assignedUserId itself and never
 * duplicates role/target/concurrency logic — every rejection shown here
 * (including SAME_ASSIGNEE and CONCURRENTLY_REASSIGNED) is the
 * authoritative server's own decision, not a client-side shortcut. The
 * eligible-target list is fetched by the server (listProspectReassignment
 * EligibleUsers, filtered to active ADMIN/MANAGER/COMMERCIAL) and merely
 * excludes the current assignee here for display — the server remains
 * the only authority on whether a submitted target is actually eligible.
 */
export default function ReassignProspectDialog({
  prospectId,
  currentAssigneeId,
  currentAssigneeName,
  eligibleUsers,
}: ReassignProspectDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [targetUserId, setTargetUserId] = useState("");
  const [reason, setReason] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const dialogRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLSelectElement>(null);

  const selectableUsers = eligibleUsers.filter((user) => user.id !== currentAssigneeId);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    targetRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        "button:not([disabled]), select:not([disabled]), textarea:not([disabled])",
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
    setSuccess(undefined);
    setTargetUserId("");
    setReason("");
    setOpen(true);
  }

  function closeDialog() {
    setOpen(false);
  }

  async function handleConfirm() {
    if (!targetUserId) {
      setError("Sélectionnez un nouveau responsable.");
      return;
    }

    if (reason.trim().length === 0) {
      setError("Indiquez le motif de la réaffectation.");
      return;
    }

    setIsPending(true);
    setError(undefined);

    const result = await reassignProspectAction({
      prospectId,
      newAssignedUserId: targetUserId,
      reason,
    });

    setIsPending(false);

    if (!result.success) {
      const presentation = resolveReassignProspectErrorPresentation(
        result.code,
        result.message,
      );
      setError(presentation.message);

      if (presentation.refreshCurrentState) {
        // The current owner or target options may already be stale —
        // never silently retry against a value the manager never
        // consciously reconfirmed.
        setTargetUserId("");
        router.refresh();
      }
      return;
    }

    const targetName = eligibleUsers.find((user) => user.id === targetUserId);
    setSuccess(
      targetName
        ? `Suivi réassigné à ${targetName.firstName} ${targetName.lastName}.`
        : "Suivi réassigné.",
    );
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
      >
        <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden="true" />
        {currentAssigneeId ? "Réassigner" : "Assigner un responsable"}
      </button>

      {open && (
        <div className="safe-top safe-bottom fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 px-4 py-8 backdrop-blur-sm">
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reassign-prospect-dialog-title"
            aria-describedby="reassign-prospect-dialog-description"
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
          >
            <h2
              id="reassign-prospect-dialog-title"
              className="text-xl font-bold text-[#0f2557]"
            >
              Réassigner le suivi
            </h2>

            {success ? (
              <>
                <p role="status" className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {success}
                </p>
                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={closeDialog}
                    className="h-12 rounded-xl bg-[#0f2557] px-5 font-semibold text-white transition hover:bg-[#18366f]"
                  >
                    Fermer
                  </button>
                </div>
              </>
            ) : (
              <>
                <p
                  id="reassign-prospect-dialog-description"
                  className="mt-2 text-sm leading-6 text-slate-500"
                >
                  Le nouveau responsable prendra en charge le suivi actuel
                  de ce prospect. Les actions et activités déjà enregistrées
                  restent attribuées à leurs auteurs.
                </p>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
                  <span className="shrink-0 text-slate-500">Responsable actuel</span>
                  <span className="break-words text-right font-semibold text-slate-700">
                    {currentAssigneeName ?? "Aucun responsable actuellement"}
                  </span>
                </div>

                <label
                  htmlFor="reassign-target"
                  className="mt-4 block text-sm font-semibold text-slate-700"
                >
                  Nouveau responsable
                </label>
                <select
                  ref={targetRef}
                  id="reassign-target"
                  value={targetUserId}
                  onChange={(event) => setTargetUserId(event.target.value)}
                  disabled={isPending}
                  className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-[#0f2557] focus:ring-4 focus:ring-blue-100"
                >
                  <option value="">Sélectionner…</option>
                  {selectableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.firstName} {user.lastName} — {getUserRoleLabel(user.role)}
                    </option>
                  ))}
                </select>

                <label
                  htmlFor="reassign-reason"
                  className="mt-4 block text-sm font-semibold text-slate-700"
                >
                  Motif
                </label>
                <textarea
                  id="reassign-reason"
                  rows={3}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  disabled={isPending}
                  placeholder="Ex. changement de responsable, réorganisation du suivi…"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-[#0f2557] focus:ring-4 focus:ring-blue-100"
                />

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
                    type="button"
                    onClick={closeDialog}
                    disabled={isPending}
                    className="h-12 w-full rounded-xl border border-slate-200 px-5 font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 sm:w-auto"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={isPending}
                    className="h-12 w-full rounded-xl bg-[#0f2557] px-5 font-semibold text-white transition hover:bg-[#18366f] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    {isPending ? "Réaffectation..." : "Confirmer la réaffectation"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
