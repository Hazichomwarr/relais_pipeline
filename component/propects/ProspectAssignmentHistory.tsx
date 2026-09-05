import { ChevronDown } from "lucide-react";

import { formatDateTime } from "@/component/propects/prospect-detail-sections";

export type ProspectAssignmentHistoryItem = {
  id: string;
  fromUser: { firstName: string; lastName: string } | null;
  toUser: { firstName: string; lastName: string };
  changedByUser: { firstName: string; lastName: string };
  reason: string;
  occurredAt: Date;
};

/**
 * Ticket 28C §26/§50-52 — a compact, secondary disclosure section
 * (native <details>, no client JS needed), never an audit-log-by-default
 * page. Newest first (28B's getProspectAssignmentTransfers already
 * orders this way). ADMIN/MANAGER only — the caller (the admin prospect
 * detail page) is the only place this is ever rendered; a Commercial-
 * facing page must never import this component (28C §25/§60).
 *
 * Truthful, never fabricated: a `null` fromUser renders "Aucun
 * responsable" (never an invented prior owner — 28B/28A never backfilled
 * initial-assignment history), and zero rows renders "Aucune
 * réaffectation enregistrée." — which is the correct, expected state for
 * any prospect that predates 28B or has never been transferred since,
 * never implied to mean the prospect never had an assignee.
 */
export default function ProspectAssignmentHistory({
  transfers,
}: {
  transfers: ProspectAssignmentHistoryItem[];
}) {
  return (
    <details className="group rounded-3xl border border-slate-200 bg-white p-5">
      <summary className="flex cursor-pointer items-center justify-between gap-2 text-sm font-semibold text-slate-700 marker:content-none">
        <span>
          Historique des réaffectations
          {transfers.length > 0 && (
            <span className="ml-2 text-xs font-normal text-slate-400">
              ({transfers.length})
            </span>
          )}
        </span>
        <ChevronDown
          className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>

      <div className="mt-4">
        {transfers.length === 0 ? (
          <p className="text-sm text-slate-500">
            Aucune réaffectation enregistrée.
          </p>
        ) : (
          <ul className="space-y-4">
            {transfers.map((transfer) => (
              <li
                key={transfer.id}
                className="border-b border-slate-100 pb-4 last:border-0 last:pb-0"
              >
                <p className="text-sm font-semibold text-slate-800">
                  {transfer.fromUser
                    ? `${transfer.fromUser.firstName} ${transfer.fromUser.lastName}`
                    : "Aucun responsable"}{" "}
                  → {transfer.toUser.firstName} {transfer.toUser.lastName}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {formatDateTime(transfer.occurredAt)} · Par{" "}
                  {transfer.changedByUser.firstName} {transfer.changedByUser.lastName}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Motif : {transfer.reason}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
