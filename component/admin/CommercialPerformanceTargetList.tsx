"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { deleteCommercialPerformanceTargetAction } from "@/src/actions/commercial-performance-target.actions";

export type CommercialPerformanceTargetListItem = {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  targetWins: number;
  locked: boolean;
  user: { id: string; firstName: string; lastName: string };
  createdByUser: { firstName: string; lastName: string };
};

type CommercialPerformanceTargetListProps = {
  targets: CommercialPerformanceTargetListItem[];
};

const MONTH_LABELS = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];

function formatPeriod(periodStart: Date): string {
  const start = new Date(periodStart);
  return `${MONTH_LABELS[start.getUTCMonth()]} ${start.getUTCFullYear()}`;
}

/**
 * Ticket 25H.2A §40/§42 — read-only period/target/status display, plus
 * deletion for still-editable (upcoming) targets only. No inline edit UI
 * in V1 — not required by the ticket's own UI minimum, and deletion +
 * recreation covers the same need for an upcoming target before it locks.
 */
export default function CommercialPerformanceTargetList({
  targets,
}: CommercialPerformanceTargetListProps) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(targetId: string) {
    setError(null);
    setPendingId(targetId);

    const result = await deleteCommercialPerformanceTargetAction({
      targetId,
    });

    setPendingId(null);

    if (!result.success) {
      setError(result.message);
      return;
    }

    router.refresh();
  }

  if (targets.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Aucun objectif commercial n’a encore été défini.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-4">Employé</th>
              <th className="py-2 pr-4">Période</th>
              <th className="py-2 pr-4">Objectif</th>
              <th className="py-2 pr-4">Statut</th>
              <th className="py-2 pr-4">Défini par</th>
              <th className="py-2 pr-4" />
            </tr>
          </thead>
          <tbody>
            {targets.map((target) => (
              <tr key={target.id} className="border-b border-slate-100">
                <td className="py-2 pr-4 font-medium text-slate-700">
                  {target.user.firstName} {target.user.lastName}
                </td>
                <td className="py-2 pr-4 text-slate-600">
                  {formatPeriod(target.periodStart)}
                </td>
                <td className="py-2 pr-4 text-slate-600">
                  {target.targetWins} prospect{target.targetWins > 1 ? "s" : ""}{" "}
                  gagné{target.targetWins > 1 ? "s" : ""}
                </td>
                <td className="py-2 pr-4">
                  {target.locked ? (
                    <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                      Objectif verrouillé
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                      Modifiable
                    </span>
                  )}
                </td>
                <td className="py-2 pr-4 text-slate-500">
                  {target.createdByUser.firstName}{" "}
                  {target.createdByUser.lastName}
                </td>
                <td className="py-2 pr-4">
                  {target.locked ? null : (
                    <button
                      type="button"
                      onClick={() => handleDelete(target.id)}
                      disabled={pendingId === target.id}
                      className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-60"
                    >
                      {pendingId === target.id ? "Suppression…" : "Supprimer"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400">
        Les objectifs sont verrouillés une fois la période commencée afin de
        préserver l’historique de l’évaluation.
      </p>
    </div>
  );
}
